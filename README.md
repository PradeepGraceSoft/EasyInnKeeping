# EasyInnKeeping Playwright Automation

End-to-end test automation for EasyInnKeeping, built with Playwright and
TypeScript. The repository includes a local test-generation assistant and a
Playwright MCP configuration for browser-assisted work in Codex.

## Prerequisites

- Node.js 22 or newer
- npm
- Access to the EasyInnKeeping test environment and test database

## Setup

```powershell
npm ci
npm run install:drivers
```

Provide the required environment values in the files under `config/`. Do not
commit real passwords, tokens, or other secrets.

## Run and verify

```powershell
# Run the complete suite
npm test

# Explicitly run against trunk (the default) or test1
npm run test:trunk
npm run test:test1

# Run one test file against a selected environment
npm run test:trunk -- tests/Smoke/SmokeSSOLogin.spec.ts
npm run test:test1 -- tests/Smoke/SmokeSSOLogin.spec.ts

# Run one test file
npx playwright test tests/Smoke/SmokeSSOLogin.spec.ts

# Run with a visible browser
npm run test:headed

# Open the most recent HTML report
npm run test:report

# Type-check the project
npx tsc --noEmit
```

### Application environments

Set `TEST_ENV` to `trunk` or `test1` to choose the application under test.
When it is not set, the test suite uses trunk. Trunk URLs remain in
`config/qa.env` for backward compatibility, while test1 URLs are maintained in
`config/test1.env`. Test1 inherits unchanged CRM, campaign-email, API, and
shared settings from `config/qa.env`. Database credentials and property test
data remain shared in `config/db.env` and `config/testdata.env`.

The same selection can be applied to any Playwright command in PowerShell.
Set the environment first, then run the test:

```powershell
# Select test1 for this PowerShell window
$env:TEST_ENV = "test1"

# Run a focused test in headed mode
npx playwright test tests/OnlineBooking/EWRChatbot.spec.ts --headed
```

The two commands can also be written on one line:

```powershell
$env:TEST_ENV = "test1"; npx playwright test tests/OnlineBooking/EWRChatbot.spec.ts --headed
```

You can also pass the environment as a Playwright argument. Quote the token in
PowerShell so it is passed through to Playwright:

```powershell
npx playwright test tests/CRM/CRM.spec.ts '$env:test1'
npx playwright test tests/CRM/CRM.spec.ts '$env:trunk'
```

The `$env:TEST_ENV` value takes precedence over project-level environment
metadata when both are present.

To switch the same PowerShell window back to trunk:

```powershell
$env:TEST_ENV = "trunk"
```

Alternatively, use the npm environment commands without setting a PowerShell
variable:

```powershell
npm run test:test1 -- tests/OnlineBooking/EWRChatbot.spec.ts --headed
npm run test:trunk -- tests/OnlineBooking/EWRChatbot.spec.ts --headed
```

### Set the number of workers

Use Playwright's `--workers` option to set the maximum number of parallel test
workers for a run:

```powershell
# Run the complete test1 suite with up to four workers
npm run test:test1 -- --workers=4

# Run a focused test in headed mode with up to two workers
npm run test:test1 -- tests/OnlineBooking/EWRChatbot.spec.ts --headed --workers=2

# The same option works with a direct Playwright command
$env:TEST_ENV = "test1"
npx playwright test tests/OnlineBooking/EWRChatbot.spec.ts --headed --workers=2
```

The current Playwright configuration limits each property project to one
worker, and tests within a property lane run sequentially. Therefore,
`--workers` controls the maximum for the overall run but does not make tests in
one property project run concurrently. Update the relevant project's `workers`
setting and review test-data isolation before enabling parallel execution
within that property.

### Parallel property lanes

The default Playwright run uses the configured property projects concurrently.
Projects with one worker keep tests for that property sequential, while
dedicated parallel projects handle reviewed suites:

| Project | Property | Assigned specs |
| --- | --- | --- |
| `property-a-5806` | A | Smoke, Calendar, POS, selected PMS specs |
| `property-5447` | B | Billing and selected PMS specs |
| `property-c-5652` | C | Group reservation and Online Booking specs |
| `property-c-5652-parallel` | C | GuestHub specs |
| `property-d-5807` | D | Shared reservation and reviewed CRM specs |
| `property-d-5807-parallel` | D | Lead and Customer CRM specs |
| `ota-property-a-1885` | A | OTA specs |

Complete the `env_PropertyA_*` through `env_PropertyD_*` entries in
`config/testdata.env` before running all projects. A focused property can be
run with `npx playwright test --project=property-5447`.

Detailed command examples are in `specs/RUN_TEST_COMMANDS.md`, and the
parallel-safety review is in `specs/PARALLEL_TEST_EXECUTION_GUIDE.md`.

## Authenticated PMS tests and saved sessions

Use [pms.fixture.ts](src/fixtures/pms.fixture.ts) for tests that should start
on the authenticated reservation list. It extends the existing SSO fixture,
so page objects such as `layoutPage` and `setupPage` remain available.

The fixture performs this flow for each test:

1. Read `LoginSessionStorage/{PropertyID}.json` for the property selected by
   the Playwright project.
2. Apply saved state through Playwright's `storageState` fixture before the
   test page is created. Each test still gets its own isolated browser context.
3. Navigate directly to the canonical `PMSUI-NG/list` route and verify that
   the authenticated reservation-list control is visible.
4. If no usable state exists or the application rejects it, complete the
   normal credentials/OTP login. Wait for the reservation list to initialize,
   then save the fresh session in the same property file.
5. Hand the authenticated page to the test, ready for actions such as Setup.

Valid sessions skip credentials and OTP. Successful reuse does not rewrite
the file. A fresh login saves cookies, local storage, and IndexedDB state,
along with the property, username, and reservation-list URL identity. Files
with a different stored identity are not reused. There is one file per
property ID; switching environments can replace that property's saved session.

### Use the fixture

For example, a spec under `tests/PMS/Payment/BridgePay/` can use:

```ts
import { test } from "../../../../src/fixtures/pms.fixture";

test("opens credit card setup", async ({ layoutPage, setupPage }) => {
  await layoutPage.clickSetupIcon();
  await setupPage.navigateToCreditCardSetup();
});
```

Adjust the relative import for the spec's location. No login `beforeEach` or
manual context creation is needed. The fixture has a separate 90-second setup
budget for authentication; ordinary test and action timeouts remain unchanged.

[BridgePaySetupPage.spec.ts](tests/PMS/Payment/BridgePay/BridgePaySetupPage.spec.ts)
uses this pattern. To migrate another authenticated PMS spec, change its
fixture import and remove redundant login setup. Existing specs importing
`sso.fixture` retain their current behavior until migrated.

Use [sso.fixture.ts](src/fixtures/sso.fixture.ts) for tests that explicitly
exercise login, OTP, logout, or different user roles, and for flows that manage
their own authentication. That fixture does not automatically log in.

Run the BridgePay session-reuse example twice:

```powershell
npm run test:trunk -- tests/PMS/Payment/BridgePay/BridgePaySetupPage.spec.ts --project=property-5447 --grep "Makes BridgePay" --repeat-each=2
```

The console reports whether the session was reused, rejected, or freshly saved.
The selected property needs credentials in `config/testdata.env`, and OTP
retrieval requires the database configured in `config/db.env`.

### Session files and utilities

| Location | Responsibility |
| --- | --- |
| `src/fixtures/pms.fixture.ts` | Load state before context creation and authenticate each test page |
| `src/utils/PmsSessionUtils.ts` | Select the configured property identity and orchestrate login |
| `src/utils/LoginSessionStorage.ts` | Read, validate, and save reusable session state |
| `LoginSessionStorage/{PropertyID}.json` | Generated session data, such as `5447.json` |

Keep `LoginSessionStorage/` as the runtime session directory. It is created
when fresh state is saved, and its JSON files are gitignored because they
contain authentication data. Do not move these files into `src/utils/` or
commit them. Removing a property's JSON file forces a fresh login on its next
authenticated test.

Outside the fixture, classes can call
`PmsSessionUtils.ensureAuthenticated(page, dbHelper)`. Initialize
`ConfigManager`, select the property, and connect the database first; the
standard fixtures handle these prerequisites in tests. Prefer `pms.fixture`
for specs so state is loaded before the test page opens.

Playwright may briefly create internal pages when applying, clearing, or saving
browser storage. These are temporary storage operations, not extra test runs.

## Local Playwright agent

The `playwright-agent/` directory contains a deterministic command-line helper
for inspecting this test framework, finding reusable page-object methods, and
generating Playwright test or method skeletons. It does not call an AI model by
itself and does not automatically edit files; generated output is printed for
review.

Run it through the project script:

```powershell
# Show all commands
npm run agent -- --help

# Inspect page objects, fixtures, and tests
npm run agent -- inspect

# List reusable scenario templates
npm run agent -- templates

# Find a page object or list its methods
npm run agent -- find-page ReservationPage
npm run agent -- methods ReservationPage

# Generate a test skeleton
npm run agent -- generate-test "Verify a new reservation"

# Generate from an existing workflow template
npm run agent -- generate-test --template shared-find-list "Verify room warning"

# Analyze a task and print a proposed workflow
npm run agent -- plan "Create a shared reservation test"

# Print the detailed generation standards
npm run agent -- standards
```

The first agent command uses `npx -y tsx`, so npm may download `tsx` if it is
not already cached. This requires access to the npm registry.

## Playwright MCP in Codex

The project-level `.codex/mcp.json` configures the official Playwright MCP
server. MCP gives Codex browser tools that can open the application, inspect
the rendered accessibility tree, click controls, enter data, and capture
screenshots. This complements the local agent: the agent understands and
generates repository code, while MCP interacts with a running browser.

To use it:

1. Open this repository as the workspace in Codex.
2. Trust the repository and allow the Playwright MCP server when prompted.
3. Restart or open a new Codex session after changing `.codex/mcp.json`.
4. Start the application or ensure the configured test URL is reachable.
5. Ask Codex to use Playwright, for example:

   > Use the Playwright browser tools to verify the SSO login flow and report
   > any failing step. Do not modify the application.

   Or combine browser exploration with implementation:

   > Inspect the reservation flow in the browser, reuse the existing page
   > objects, and add a focused Playwright test for it.

MCP may run `npx -y @playwright/mcp@latest` the first time, which requires npm
registry access. Browser actions can affect the connected test environment, so
use dedicated test data and explicitly approve destructive workflows.

## Codex repository guidance

`AGENTS.md` contains the persistent coding conventions and verification
commands Codex should follow in this repository. `.codex/mcp.json` contains only
the Playwright tool integration. Both files can be committed so teammates get
the same repository-specific setup.

## CI

- `.github/workflows/playwright.yml` runs the suite in GitHub Actions.
- `azure-pipelines-5.yml` runs the suite in Azure Pipelines.

Keep only the CI configuration used by your team.
