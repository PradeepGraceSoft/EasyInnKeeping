# EasyInnKeeping Test Commands

Use these PowerShell commands to generate a manual Playwright command for the
test you want to execute.

## Run a test file

Replace `<test-file>` with the path to the test file.

```powershell
npx playwright test <test-file> '$env:test1'
npx playwright test <test-file> '$env:trunk'
```

Examples:

```powershell
npx playwright test tests/CRM/Lead.spec.ts '$env:test1'
npx playwright test tests/OnlineBooking/GuestHub/OTPAuthentication.spec.ts '$env:trunk'
```

## Run by test name or folder

```powershell
npx playwright test -g "<test-name>" '$env:test1'
npx playwright test tests/CRM '$env:test1'
```

## Optional command switches

Add these switches before the environment parameter when needed:

```powershell
# Run with the browser visible
npx playwright test <test-file> --headed '$env:test1'

# Run in debug mode
npx playwright test <test-file> --debug '$env:test1'

# Run with a specific project
npx playwright test <test-file> --project=property-d-5807 '$env:test1'

# Limit parallel workers
npx playwright test <test-file> --workers=1 '$env:test1'
```

## Command template

When given a test to execute, use this format:

```text
npx playwright test <test-file> [options] '$env:<test1-or-trunk>'
```

Environment files:

- `'$env:test1'` loads `config/test1.env`.
- `'$env:trunk'` loads `config/qa.env`.

Current project names:

- `property-a-5806`
- `property-5447`
- `property-c-5652`
- `property-c-5652-parallel`
- `property-d-5807`
- `property-d-5807-parallel`
- `ota-property-a-1885`
