# POS module: feature behavior and Playwright test guide

## Purpose

Use this reference to design POS end-to-end scenarios and to convert approved scenarios into Playwright TypeScript tests. It records the current source-based behavior, required fixtures, observable results, and implementation risks. It is not a substitute for an approved financial/business-rule specification: investigation items must be resolved before being turned into acceptance assertions.

**Automation conventions:** keep UI interaction in `src/pages/` page objects, import `{ test, expect }` from `src/fixtures/sso.fixture`, use accessible/scoped locators, register request/response waits before mutations, and never use fixed sleeps. Each mutable order must be unique to one test worker.

## Module overview

POS is available inside the shared application layout and has three stateful views; do not assume that each is a separate URL.

| View | User-facing responsibilities |
| --- | --- |
| Dashboard | Sales/order metrics, revenue/category charts, sales volume, best sellers, low stock, and recent transactions. |
| Orders | Searchable, filtered, paginated orders; details, terminal reopening, printing, cancellation, and completion. |
| POS Terminal | Outlet/product selection, order editing, kitchen flow, discounts, payments, refunds, and receipt preview. |

The signed-in property context provides `PropertyId`; POS uses `POSId = R<PropertyId>`. Write operations also require the operator/staff identity and, where available, the active shift. Fixtures must keep property, outlet, user, and shift consistent.

## Terminal behavior

### Outlet selection and new orders

1. Opening **POS Terminal** loads outlets and print/cash-drawer configuration.
2. Zero outlets shows `No outlets configured.` One outlet is selected automatically; multiple outlets open **Select Outlet**.
3. An outlet selection loads products, captains, waiters, tables, kitchen messages, and live orders. **Change** opens the outlet selector again.
4. A new local order has `OrderId = 0`, `OrderNo = 0`, no items, and zero totals. It becomes `New` on the first successful item save.
5. Restaurant service types are **Table**, **Room Service**, and **Take Away**. Current validation requires captain, waiter, table, and service type for all three; retail hides and skips these fields.
6. Adding, changing quantity, deleting, editing price, or saving instructions persists immediately. There is no normal separate Save button.
7. After a new save, use the backend-returned order ID to reload the order and its items. The order rail switches saved orders and **+** creates a new empty local order.

### Catalog and line items

- **Search** is case-insensitive over item, group, and subgroup names; it runs on input change or **Find**. A no-match result displays `No items found!`, clears the query, and restores the catalog.
- Barcode input is debounced by 500 ms, strips the first `*` and `;`, and matches `BarCode`. A unique match adds one item; no match shows feedback; duplicate matches filter the catalog for manual selection.
- The filter dialog narrows subgroup choices by main group; selected subgroup filters by `AccSubId`; clearing restores all products.
- Re-adding the same account code merges into an existing line only when that line has no comments. Commented lines remain distinct.
- Decrementing quantity one removes the line and sends it in `DeletedItems`. Rate edits use the numeric field/check action and immediately recalculate/save.
- Kitchen instructions support existing messages and semicolon-separated new messages. Submit each unique nonempty new message through `AddKitchenMessage`, then persist the line comments.
- Catalog additions are permitted only for `New` or `Sent`. Other statuses show `The sale is closed. Please create a new order`. Quantity/rate controls need dedicated investigation coverage.

### Restaurant state flow

| Outlet | Persisted status | Visible terminal actions |
| --- | --- | --- |
| Restaurant | New | Send Order, Cancel |
| Restaurant | Sent | Send Order, Sale Finished, Cancel |
| Restaurant | Finished | Pay, Print, Discount, Cancel |
| Restaurant | Paid | Pay, Print |
| Non-restaurant | New | Print, Discount, Pay, Cancel |
| Non-restaurant | Paid | Print, Pay |

Restaurant flow: add item → **Send Order** (`Sent`) → **Sale Finished** (`Finished`) → **Pay**. Retail can pay from `New`. The payment command is `Pay`, but assertions must use refreshed persisted status and balances rather than assuming it directly means `Paid`.

When `ShowMenuIcons` includes `printbill`, sending shows kitchen print preview; otherwise it shows sent-success feedback. Cancellation is a Yes/No Material dialog and persists `Cancelled` only after Yes. Paid orders must be protected in both the terminal and Orders view.

## Money, discounts, and payment

### Totals and discounts

Discount choices are **Percent** (`Percent`) and **Flat Amount** (`Flat`). A type is required and values must be greater than zero. Saving persists `DiscountType` and `Discount`; deleting the returned Discount row resets them to empty/zero.

The terminal's read-only **Total**, **Tax**, **Amount Paid**, and **Amount Due** values come from the returned order. Do not calculate merchandise totals from every returned row: responses can contain `OrderItem`, `Discount`, and `Payment` rows. Seed approved examples for tax/discount rounding; price format `0` rounds to two decimals, `1` to whole numbers, and other formats round upward.

### Payment choices

| Choice | Required selection and saved behavior |
| --- | --- |
| New Customer | Payment account; changing back to this clears reservation/card selection and account. |
| Checked-in Guest | Guest/reservation; supported saved card/card type may choose the account. |
| Add to Room | Reservation; returns account code `0`, account name `Room Charge`, and the confirmation number. |

Payment starts at Amount Due. **Add Payment** requires an account except Add to Room, which requires a reservation. The terminal then sends `OrderInfo` with status `Pay`, payment details, identity/shift data, and empty `Items`/`DeletedItems`.

For card account codes `112, 114, 116, 118, 120, 122, 124`, **Process Card** calls the gateway before saving. On success it returns `AuthTransId`; failure shows `Payment Failed`, leaves the dialog open, and must not save a payment. Add Payment remains visible for card accounts, so expected manual-card behavior requires a business decision.

If configuration requires a cash drawer and it is closed, cash payment/refund/deposit account names must be blocked with `Please open a cash drawer before processing a cash payment.` No payment write may occur. After any successful payment, refresh the order, assert partial/final due and receipt, and verify no duplicate payment.

Refunding a payment row requests native confirmation, calls the refund service, and sends `OrderInfo` with status `Refund` only after `PaymentResult` is true. It refunds that row's full amount; there is no terminal refund-amount editor.

## Orders, dashboard, and printing

Orders supports tabs **All**, **Online**, **POS**, **Add to Room**, **Pending**, **Completed**, **Cancelled**, and **Refunded**; payment filters **Any payment**, **Paid**, **Partial Paid**, **Unpaid**, **Refunded**, and **Partial Refund**. Search waits 350 ms and sends a trimmed query. Search/filter/page-size changes reset to page 1; page sizes are 10, 25, 50, and 100.

Selecting an order opens its drawer; Escape closes it. Non-online orders can open in POS using their existing identity/outlet and `GetOrderItems`; online orders cannot. **Mark completed** updates status but does not take payment, so assert payment and display status independently. Raw status labels are normalized for display (new/sent/pending → Pending; cancelled/refunded/draft retain their labels; others → Completed).

Dashboard timeframe buttons are today, week, and month. Week/month currently mean today minus 7/30 days through today, not calendar periods. Changing timeframe reloads cards, charts, and best sellers. **New Sale** opens a fresh terminal; **View all** opens Orders. For canvas charts, assert labels and API-backed metrics, with visual tests only as supplementary coverage.

Receipt preview excludes `Payment` rows, while kitchen output includes quantities and instructions. Printing opens a popup, writes `printArea`, calls browser print, and later closes it. Test preview/popup generation, not physical printer output.

## Required test data

| Fixture | Minimum data |
| --- | --- |
| Operator | Authenticated user with property, locale/currency, labels, print settings, and known shift. Reproduce required session storage through the auth fixture. |
| Outlets | Zero, one, and multiple; restaurant, retail, and a distinct second outlet. |
| Restaurant | Two tables with staff/occupancy defaults, captains, waiters, and missing-field variants. |
| Products | Unique names/codes, percentage/flat/zero tax, unique/duplicate barcode, groups/subgroups, an item without image. |
| Orders | New, Sent, Finished, Paid, Cancelled, refunded, partial payment, Online/POS/Add-to-Room, and enough for pagination. |
| Payments | Checked-in guest/confirmation, cash, sandbox card/saved card, open/closed drawer, deterministic gateway success/failure. |
| Dashboard | Known totals, date-boundary rows, empty state, low stock, and best sellers. |

Use a dedicated property and payment sandbox or deterministic mocks. Capture generated IDs, freeze date/timezone where appropriate, and use approved cleanup/seed reset; cancellation is not financial cleanup.

## Scenario catalog

Implement each as an independent test or explicit parameterized group. P0 covers checkout/data integrity, P1 normal regression, P2 edge/recovery.

| IDs | Priority | Scenario and core assertion |
| --- | --- | --- |
| POS-001–004 | P0/P1 | Fresh tab navigation; no/one/multiple outlet selection; switching outlets does not use stale catalog or write to the old outlet. |
| POS-005–009 | P0/P1 | Search/filter catalog; no match reset; unique, unknown, and duplicate barcode paths. |
| POS-010–012 | P0 | Restaurant required-field validation and first save; retail first save without restaurant data/action matrix. |
| POS-013–017 | P0/P1 | Merge/unmerge commented items; quantity deletion and `DeletedItems`; kitchen messages; rate/tax calculation. |
| POS-018–021 | P0/P1 | Restaurant Sent → Finished flow; printbill modes; order rail isolation; fresh terminal after navigation. |
| POS-022–024 | P0/P1 | Percent/flat discount; invalid/closed dialog; change/delete discount row. |
| POS-025–033 | P0/P1 | Missing payment method, cash full/partial payment, closed drawer, card success/failure, guest reset, room charge, safe close/X. |
| POS-034–039 | P0/P1/P2 | Cancel No/Yes and paid protection; refund reject/success/failure; receipt correctness; print popup. |
| POS-040–048 | P0/P1 | Order list stats, tabs/filters/search/page reset, pagination, drawer isolation, reopen in terminal, online restriction, completion and cancellation. |
| POS-049–051 | P1 | Dashboard timeframe request dates, populated/empty data, New Sale and View all navigation. |
| POS-052 | P2 | Fail/delay list, item, save, and payment requests: no false success or duplicate financial posts. |

Start smoke with POS-001, POS-011, POS-012, POS-018, POS-026, POS-034, and POS-045.

## Implementation checklist for a scenario

1. Record fixture IDs and setup/cleanup method.
2. Add or reuse one-action page-object methods; keep locators grouped in the page object.
3. Start endpoint waits before the UI event; assert method, endpoint, POS/order/outlet IDs, and command status.
4. Wait for the authoritative refresh (`GetOrders`, `GetOrderItems`, or list response) and verify both visible result and persisted data.
5. For dialogs, scope locators to the dialog. Handle native confirm/alert before the click; use the Material dialog path for Yes/No confirmations.
6. On failure, capture trace, screenshot, and page errors. Do not weaken an expected business flow to accommodate an application defect.

Useful request contracts: `GetOutlets` uses POS ID; item/staff/table/message reads use POS ID plus outlet; `OrderInfo` includes identity/status/item changes or payment; `GetAllOrders` sends page/filter/trimmed search; `CompleteOrder` preserves original order identity; room charge uses selected confirmation. Resolve API base URLs from `PosService`/`DynamicServiceUrls`, never hard-code a host.

Suggested specs: `pos-navigation.spec.ts`, `pos-catalog.spec.ts`, `pos-orders-editing.spec.ts`, `pos-discounts.spec.ts`, `pos-payments.spec.ts`, `pos-cancel-refund-print.spec.ts`, `pos-orders-list.spec.ts`, `pos-dashboard.spec.ts`, and `pos-recovery.spec.ts`.

### Current POS smoke coverage

`POSCashPayment.smoke.spec.ts` is an opt-in smoke flow for property `5398`. It logs in as the configured staff user, opens the cash drawer through the existing setup helper, creates and cash-pays one Gift Shop order and one Restaurant order. Enable its isolated Playwright project only when property-E configuration is supplied outside source control:

```powershell
$env:POS_SMOKE_ENABLED = "true"
npx playwright test tests/POS/POSCashPayment.smoke.spec.ts --project property-5398-pos-smoke
```

The project reads `env_PropertyE_PropertyID`, `env_PropertyE_PropertyShortName`, `env_PropertyE_LoginName`, and `env_PropertyE_Password` from the environment/configuration convention; do not add credentials to tracked files. This smoke test creates financial orders and must run only in the dedicated test property with an approved cleanup policy.

## Investigation backlog (do not silently accept)

| ID | Risk / decision required |
| --- | --- |
| G01 | Repeated outlet selection may accumulate groups/subgroups; dismissing selector/filter dialogs may dereference an empty result. |
| G02 | Quantity state is shared between rows; rate/quantity edits may bypass closed-order protection. |
| G03 | Tax can differ for equivalent baskets created by repeat-click, quantity controls, or edited price. Define authoritative totals. |
| G04 | Discount/payment validation lacks clear null, maximum, overpayment, and rounding rules. |
| G05 | Payment/discount X controls may return truthy `"false"`; prove they never save or throw. |
| G06 | Manual card and checked-in guest workflows need an approved gateway/reservation rule. |
| G07 | Details drawer can show sample items for missing data and may mishandle percentage discounts. |
| G08 | Orders print with outlet ID 0 and outlet-type checks differ from terminal behavior. |
| G09 | Table control uses `(change)` and duplicates the `Type` label; table changes need verification and unique locators. |
| G10 | Some success feedback precedes persistence and errors are not always handled. Test failed writes/false completion/safe retry. |
| G11 | Stored procedures determine totals/status; display Completed does not prove settlement. Validate integration mappings. |

## Source map

Review the POS route and header, terminal component/template, payment/discount/kitchen-message dialogs, orders/list/detail components, dashboard/print components, and `services/pos.service.ts` before extending automation. Backend sources include `PMS.WebAPI/Controllers/POSController.cs`, `PMS.Domain.Service/Managers/POSManager.cs`, and `PMS.Domain.Model/Models/POS.cs`; card/refund integration is in `PMSUI/src/app/modules/billing/services/payment.service.ts`.
