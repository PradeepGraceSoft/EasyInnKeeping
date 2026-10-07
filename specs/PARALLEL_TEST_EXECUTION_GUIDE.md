# Parallel Playwright Test Review Guide

Use this guide before enabling parallel execution for any Playwright spec in this
repository. It records the review performed for `tests/CRM/Lead.spec.ts` and
provides reusable patterns for other specs.

## Goal

Tests can run concurrently only when every test has isolated state. A test must
not depend on record order, shared configuration, shared UI selection, or a
global count that another worker can change.

## Review checklist

Review the spec, its page objects, fixtures, database helpers, and any external
systems it uses.

| Risk | Unsafe pattern | Parallel-safe replacement |
| --- | --- | --- |
| Database record selection | `TOP 1`, `MAX(Id)`, or "latest record" | Query/update by the test's unique email, ID, or generated correlation key. |
| Shared database configuration | Change a default provider, feature flag, or property setting | Do not mutate it in a parallel test. Verify the existing state, or put the mutation in a separately serialized test. |
| Grid assertions | Assert total row count or all rows after another worker may create records | Assert only the test's uniquely identified row. |
| Search assertions | Require every rendered row to contain a term | Verify the search input and the uniquely identified expected row. Grid cells may truncate displayed text. |
| Email recipients | Reuse an inbox/address | Generate a unique recipient per test and verify only messages sent after a captured timestamp. |
| Browser/UI state | Reuse a page, dialog, selected grid rows, or session | Each test should use its own page/context through the fixture and locate its own record. |
| External side effects | Shared mailbox, provider, API state, or file | Isolate by unique key, use a service-supported lock, or keep that scenario serial. |

## Lead spec review result

`Lead.spec.ts` is suitable for parallel execution after these changes:

1. Every created lead uses `GmailHelper.createUniqueRecipient(...)`.
2. Status and created-date database updates target `EmailId`, never the latest
   lead in the property.
3. The default email-provider test validates the active configured provider; it
   no longer changes the provider for every other worker.
4. Search and filter-reset assertions do not depend on the total number of
   records in the shared lead grid.
5. Page-object actions activate the visible Lead dialog section before acting
   on controls. This prevents hidden-tab interaction failures independently of
   worker timing.

The dedicated `property-d-5807-parallel` project runs the Lead and Customer
files with four workers. The normal `property-d-5807` project ignores both
files, preventing them from being executed twice.

## Required implementation patterns

### 1. Enable parallel mode in the spec

Place this at module level, after imports:

```ts
test.describe.configure({ mode: "parallel" });
```

Do this only after completing the remaining checklist items.

### 2. Generate a test-owned key

Use one stable unique value throughout the test. Email is the Lead module's
natural key.

```ts
const firstName = TestDataGenerator.firstName();
const lastName = TestDataGenerator.lastName();
const email = GmailHelper.createUniqueRecipient(`lead-${firstName}-${lastName}`);

await createLead(leadPage, { firstName, lastName, email });
```

Do not create the unique email inline if the same test later updates the record.
Store it in a variable and pass it to the database helper.

### 3. Make database helpers target the owned record

Avoid this:

```ts
// Unsafe: another worker can create a newer record before this query runs.
WHERE LeadId = (
  SELECT TOP 1 LeadId
  FROM EconnectCRM.dbo.LeadList
  ORDER BY LeadId DESC
)
```

Use this pattern instead:

```ts
const escapedEmail = email.replace(/'/g, "''");
await DatabaseUtils.executeUpdate(`
  UPDATE EconnectCRM.dbo.LeadList
  SET StatusId = ${statusId}
  WHERE CompanyId = ${companyId}
    AND LeadType = 1
    AND IsDeleted = 0
    AND EmailId = '${escapedEmail}'
`);
```

Call it with the test-owned key:

```ts
await crmLeadDbHelper.updateLeadStatus(companyId, email, status);
```

The helper should validate its inputs and escape SQL string values. Prefer a
record ID if the application exposes one reliably.

### 4. Avoid shared configuration writes

This is not parallel-safe:

```ts
await crmLeadDbHelper.activateEmailConfiguration(defaultProvider);
```

Use a read-only assertion instead when the configured state is a test
precondition:

```ts
await expect(
  crmLeadDbHelper.getEmailConfigurationState(defaultProvider),
).resolves.toEqual({ isActive: true, isDefault: true });
```

If a write is essential, isolate it in a different spec/project with one worker
or use an explicit cross-worker lock supported by the backing service.

### 5. Scope UI assertions to the test record

Avoid shared total-count assertions:

```ts
const count = await page.getVisibleLeadCount();
// Another worker may create/delete a row before this assertion.
await page.verifyAllLeadsDisplayed(count);
```

Prefer assertions on the test's row:

```ts
await leadPage.verifyLeadVisible(firstName, lastName);
await leadPage.verifySingleFilteredLead(firstName, lastName, submissionDate);
```

## Dedicated project pattern

When only one spec is ready for more workers, create a dedicated project rather
than increasing workers for every spec sharing the property:

```ts
propertyProject(
  "property-d-5807",
  "D",
  ["**/SmokeSharedReservation.spec.ts", "**/CRM/**/*.spec.ts"],
  {
    workers: 2,
    testIgnore: ["**/CRM/Lead.spec.ts", "**/CRM/Customer.spec.ts"],
  },
),
propertyProject(
  "property-d-5807-parallel",
  "D",
  ["**/CRM/Lead.spec.ts", "**/CRM/Customer.spec.ts"],
  { workers: 4 },
),
```

The shared `propertyProject` helper adds the selected environment and Chromium
configuration. Property IDs come from the active property test data, not from
project metadata.

## Verification sequence

Run these checks after the refactor:

```powershell
npx tsc --noEmit
npx playwright test tests/CRM/Target.spec.ts --list
npx playwright test tests/CRM/Target.spec.ts --workers=4
```

Start with a small representative subset when the spec includes expensive email
or database scenarios:

```powershell
npx playwright test tests/CRM/Target.spec.ts --grep "create|modify|delete" --workers=4
```

Then run the full file. Investigate any failure that appears only with multiple
workers; do not fix it by adding `waitForTimeout()` or retrying a global query.

## When to keep a test serial

Keep a test or a separate spec serial when it cannot safely isolate its state,
including:

- changing property-wide defaults or feature flags;
- deleting/resetting a shared dataset;
- validating a fixed external mailbox or a fixed account quota;
- testing ordered workflows where one test intentionally consumes another
  test's output.

Use `test.describe.serial(...)` only for that small group. Do not mark an entire
spec serial simply because one scenario has shared state.

## Commands for Lead

```powershell
npx playwright test tests/CRM/Lead.spec.ts '$env:test1'
```

The configured `property-d-5807-parallel` project selects this file
automatically. Use `--project=property-d-5807-parallel` when you want to make
that selection explicit.
