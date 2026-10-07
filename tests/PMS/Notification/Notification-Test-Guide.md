# Notification module: feature behavior and Playwright test guide

This document describes the current repository implementation and provides scenarios for writing Playwright tests. It is based on source inspection, not a live application test run. Items labelled **Review required** are implementation gaps or ambiguous product behavior; do not silently turn them into approved acceptance criteria.

## 1. Scope and user journey

The module lets a signed-in staff member view notifications for the current property, manage their read/deleted state, and configure notification preferences.

1. Sign in and select a property.
2. Click the header bell, labelled **Notifications**.
3. Review up to ten unread notifications, newest first.
4. Mark an individual notification as read using its checkmark button, or select **View all notifications** to open `/notifications`.
5. In **Notification Center**, search, filter by type, change sorting, select notifications, and perform bulk actions.
6. Open the gear icon in the dropdown to access **Notification Preferences**. Changes save immediately; there is no Save button.

In-app notifications and native browser push notifications are separate surfaces. Browser permission is needed to enable browser push; it is not a prerequisite for reading the in-app list. OTA availability banners and the separate messaging badge are outside this guide.

## 2. Feature behavior

### Header and dropdown

- The bell badge counts unread, non-archived items in the shared notification service after access filtering.
- Current badge formatting is `0` through `10`, then `9+` when the count is **greater than 10**. A count of ten displays `10`.
- The bell uses the `is-ringing` class when the unread count is greater than zero.
- Clicking the bell toggles the dropdown. Clicking outside closes it. Opening the profile dropdown also closes it.
- Opening the notification dropdown fetches notifications. Layout initialization and navigation also trigger fetches, so one interaction may involve multiple list requests.
- The dropdown shows only unread items, sorted by age, with a maximum of ten rows.
- Each row shows title, description, category icon, actor/category fallback, relative time, and nonzero confirmation/group numbers prefixed with `#`.
- **Mark notification as read** immediately sends a read-status request without confirmation. While pending, the button is disabled and shows `hourglass_empty`. On success the item leaves the dropdown and the unread badge updates; the next unread item can fill its place.
- A failed read request leaves the item unread and enables retry. No dedicated failure message is implemented here.
- An empty dropdown displays **No Notifications** and **New notifications will appear here.**
- **View all notifications** closes the dropdown and navigates to `/notifications`.
- Notification rows do not navigate to their stored `url` when clicked.

### Notification Center

| Control | Current behavior |
| --- | --- |
| Initial state | Unread tab, empty search, All types, Newest first; first ten matching rows rendered. |
| Unread | Shows unread, non-archived notifications. |
| All | Shows read and unread, non-archived notifications. |
| Tab counts | Calculated from all loaded notifications; search/type filters do not change them. |
| Search | Trims input and matches case-insensitive substrings in title, description, actor, category, notification ID, and source. |
| Type filter | All types plus distinct categories from the loaded accessible data. |
| Sorting | Newest first or Oldest first, based on age in whole minutes. Use timestamps separated by more than a minute for deterministic ordering. |
| Scrolling | Scrolling within 80 pixels of the list bottom appends up to ten more rows locally; no paging API is called. |
| Filter/tab changes | Reset visible row limit to ten; existing selection is retained. |
| Row checkbox | Adds/removes that notification from selection; selecting does not mark it read. |
| Header checkbox | Selects every filtered item, including items not rendered yet. Unchecking removes only filtered items from selection. |
| Bulk action bar | Appears when selection is nonempty and shows the total selected count. |
| Mark as read | Confirms, then updates selected unread items. Already-read selected items are skipped. On success selection clears and counts update. |
| Delete | Confirms, then deletes all selected items for the current user. On success rows are removed, selection clears, filter options refresh, and visible limit resets. |
| Mark all read | **Review required:** confirms but calls DeleteNotification. On Unread it targets all loaded unread items, falling back to all loaded items when none are unread. On All it targets all loaded items. Search, type filter, rendered row limit, and selection do not constrain it. |
| Empty results | Shows No notifications found and Adjust your filters or search text to see more notifications. Header checkbox is disabled. |

The three confirmation questions are:

- `Are you sure you want to mark the selected notification(s) as read?`
- `Are you sure you want to delete the selected notification(s)?`
- `Are you sure you want to mark all notifications as read?`

These are application dialogs with **Yes** and **No** buttons, not browser confirmation dialogs. Only **Yes** performs the action.

There is no exposed Archive tab/action, Mark unread action, priority/source/property filter, Clear filters button, or priority badge. Some supporting TypeScript members exist, but these controls are absent or commented out in the template.

### Access and preferences

Access comes from the staff member's function permissions. The frontend sends these flags to the API and filters the returned data again.

| Permission | Request flag | Visible categories (case-insensitive) | Preference IDs |
| --- | --- | --- | --- |
| View HouseKeeping | houseKeeping | HouseKeeping | 5 |
| View Billing | payment | Payment | 2 |
| View Reservation | reservation | Reservation, GuestHub | 3, 4 |
| View Inbox | inbox | Inbox, Message | 6, but the preferences template hides its row |
| No category permission required | None | No additional category | 1, browser push |

Unknown categories, including the mapper's `System` fallback, are filtered out. Preference titles, descriptions, icons, and enabled state come from the API; do not invent fixed UI titles for IDs 2–5.

Preferences are stored by setting, property, and user. Toggling a normal setting sends an update immediately. An HTTP failure rolls the toggle back. Closing and reopening should retrieve the persisted value.

Enabling setting **1** first requests browser notification permission, registers/activates the Firebase service worker, obtains an FCM token, and posts that token. Only after this succeeds does the application enable the setting. Disabling setting 1 skips token registration; it does not revoke browser permission.

- Missing property/user context: `Unable to enable browser notifications. Please refresh and try again.`
- Permission/token registration failure: `Browser notification permission is required to enable push notifications.`
- Either failure leaves setting 1 off and skips the enable-setting request.

### Where notifications originate

The backend contains these creation paths. Exercise them in a separate integration suite using the corresponding real business workflow and controlled data; mocked list responses do not prove event generation works.

| Business event | Category / event | Enabling setting | Content to verify |
| --- | --- | --- | --- |
| Create individual/group reservation | Reservation / New Reservation | 4 | Guest, arrival and stay length for individual bookings; group name/code for group bookings. |
| Cancel reservation | Reservation / Cancelled Reservation | 4 | Guest, arrival, confirmation number. |
| Check out reservation | Reservation / Checked Out Reservation | 4 | Guest and confirmation number. |
| Complete self check-in | GuestHub / Self Check - In Completed | 3 | Guest and reservation number. |
| Purchase optional cart items | GuestHub / Purchase Cart Items | 3 | Guest and reservation number. |
| Payment/refund outcome | Payment / Payment Received, Payment Failed, Refund Processed, or Refund Process Failed, suffixed with ` from <Referral>` | 2 | Amount, currency, guest, reservation/order reference; payment type for refunds. POS uses Order in the message. |
| Change housekeeping status, assignee, notes, or room notes | HouseKeeping / Housekeeping Assigned or Housekeeping Update | 5 | Room and changed values/actor. No notification when all change flags are false. |

Creation checks whether **any** enabled record exists for the setting/property, not specifically the acting user. To verify suppression, disable that setting for every test user at the isolated test property. Retrieval uses `dbo.sp_core_pushnotifications` in `getnotification` mode; its SQL definition was not found in the inspected repository. Verify recipient delivery and preference filtering against the deployed database rather than assuming that disabling one user's setting prevents row creation.

## 3. API contracts for fixtures and assertions

The configured API host supplies these paths. Do not hard-code a production host.

| Method and path | Request | Response / purpose |
| --- | --- | --- |
| POST /api/Notification/GetNotifications | `{ property_id, user_id, houseKeeping, payment, reservation, inbox }` | Array of notification records. |
| POST /api/Notification/UpdateNotificationReadStatus | `{ id, property_id, user_id, isread: true }` | Mutation result object. |
| POST /api/Notification/DeleteNotification | `{ id, property_id, user_id }` | Mutation result object. |
| GET /api/Notification/GetNotificationSettings | Query: `propertyId`, `userId`, `houseKeeping`, `payment`, `reservation`, `inbox` | Array of settings. |
| POST /api/Notification/UpdateNotificationSetting | `{ setting_id, isActive, property_id, user_id, staffName }` | Mutation result object. |
| POST /api/PushNotification/InsertOrUpdateFcmToken | `{ property_id, user_id, device_type, fcm_token }` | Token registration response. |

The notification controller constructs mutation responses with a `Success` property; JSON serialization may expose it as `success`. Capture the actual deployed response casing when implementing mocks. Current notification components treat any HTTP-success response as successful without checking this flag.

Example notification fixture (API shape, not the internal UI model):

```json
[
  {
    "id": 91001,
    "property_id": 501,
    "confirm_num": 88001,
    "group_code": 0,
    "isread": false,
    "notification_type": "Reservation",
    "notification_event": "New Reservation",
    "notification_message": "QA Guest is arriving for a 2-day stay. Confirmation #: 88001",
    "url": "list",
    "created_at": "2026-09-17T09:00:00Z"
  }
]
```

Example settings fixture:

```json
[
  {
    "setting_id": 4,
    "property_id": 501,
    "setting_title": "QA Reservation Notifications",
    "setting_description": "Reservation events for the test property",
    "setting_icon": "event_available",
    "isActive": true
  }
]
```

Use actual seeded property/user identifiers for live tests. The fixture title above is test data, not a guaranteed production label.

Mapping rules to cover:

- `notification_event` becomes title, falling back to category; absent message becomes empty text.
- Missing confirmation/group number becomes zero and is not displayed.
- A message ending in ` by <name>.` supplies the actor; otherwise category is used.
- Valid dates produce Just now, minute(s) ago, hour(s) ago, or day(s) ago. Invalid dates produce empty time text; future dates clamp to Just now.
- API records are not mapped to archive or priority fields. Do not add those fields to an HTTP fixture and expect archive/priority UI behavior.
- Read and delete operations append user identifiers to `is_read_by` and `is_deleted_by`; they do not physically delete the notification row. Persistence and cross-user isolation require backend verification.

## 4. Test setup and fixture plan

1. Use a running PMSUI and API, or intercept the notification endpoints while using a valid authenticated application session. Set the test base URL for the target environment.
2. Prepare a full-access user, users with one permission at a time, and a user with none of the four permissions. For isolation tests, use two users and two properties.
3. Build a baseline of 23 accessible notifications: 18 unread and 5 read, with distinct IDs and timestamps, mixed categories, unique searchable text, and both zero/nonzero confirmation/group numbers.
4. Add separate fixtures for zero items, all-read items, 9/10/11 unread items, unsupported categories, absent optional fields, long text, and delayed/failed responses.
5. Keep time deterministic: freeze the browser time or generate timestamps relative to test time. Use explicit timezone offsets in mocked dates; verify live property timezone behavior separately.
6. Install intercepts before opening the page or dropdown. Stateful mocks must update their data after mutations so subsequent layout/dropdown fetches do not resurrect items.
7. Reset notification records, preferences, permission context, and selection between tests. Restore modified preferences after integration tests. Avoid shared mutable fixtures across parallel tests.
8. For bulk operations, collect the set of requested IDs; do not assert request order because requests are concurrent. For cancellation, verify that no mutation requests were sent.

`PMSUI/package.json` currently has Angular/Karma/Protractor tooling and no declared Playwright dependency or Playwright script. This document is a specification for a future suite; it does not introduce a test runner or executable tests.

## 5. Playwright use cases

Priority: **P0** core regression, **P1** full functional coverage, **P2** edge/integration coverage. Unless marked otherwise, expected results below describe current source behavior. Each row can become one or more independent tests.

### Navigation, dropdown, and access

| ID | Priority | Preconditions and steps | Assertions |
| --- | --- | --- | --- |
| NTF-001 | P0 | Full access; load baseline and click Notifications. | Correct property/user/access flags sent; dropdown visible; ten newest unread rows; badge 9+. |
| NTF-002 | P1 | Open dropdown; click bell again, then reopen and click outside. | Both actions close it; clicking ordinary content inside does not close it. |
| NTF-003 | P1 | Parameterize unread counts 0, 1, 9, 10, 11. | Badge values 0, 1, 9, 10, 9+ respectively; ringing class only for nonzero counts. See review item R2. |
| NTF-004 | P0 | Open dropdown with unread items; mark one as read. | One read request for that ID with isread true; row disappears; count decreases; no confirmation or navigation. |
| NTF-005 | P1 | Delay individual read response; attempt a second click. | Button disabled/pending icon; no duplicate request; success removes row. |
| NTF-006 | P1 | Fail individual read request; retry successfully. | Row/count unchanged after failure; button enabled; retry updates state. |
| NTF-007 | P1 | Return empty list, then an all-read list in a separate test. | Dropdown empty copy visible; View all notifications still available. |
| NTF-008 | P0 | Click View all notifications. | URL resolves to notifications route; dropdown closes; center heading and Unread default visible. |
| NTF-009 | P0 | Parameterize permission profiles; deliberately return all categories from mock API. | Only permitted categories survive frontend filtering; badge/type options reflect that filtered set. None-profile sees no category rows. |
| NTF-010 | P1 | Return unknown/System category and null optional fields alongside valid items. | Unsupported categories excluded; valid items render fallbacks without breaking the list. |
| NTF-011 | P1 | Open gear in dropdown, then close preferences with X. | Notification Preferences dialog opens; close dismisses it; no Save action required. |

### Center, filtering, selection, and mutations

| ID | Priority | Preconditions and steps | Assertions |
| --- | --- | --- | --- |
| NTF-012 | P0 | Open center with 18 unread/5 read; switch Unread to All. | Counts 18 and 23; initial ten rows; read styling only on read rows in All. |
| NTF-013 | P1 | Search separately by title, description, actor, category, notification ID, mixed case, and padded text. | Matching is case-insensitive and trimmed; nonmatching rows hidden; tab counts unchanged. |
| NTF-014 | P1 | Search a confirmation/group number present only in metadata, not searchable text/ID. | No match solely from confirm_num/group_code; these fields are not directly searched. |
| NTF-015 | P1 | Enter no-match text; clear via input clear control. | Empty copy and disabled select-all; clearing restores matches under the current tab/type filter. |
| NTF-016 | P0 | Select one type; combine with matching/nonmatching search; restore All types. | Intersection of status, search, and category is shown; type list is unique and sorted. |
| NTF-017 | P1 | Switch Newest first to Oldest first and back. | Correct order across distinct timestamps; visible limit resets to ten. |
| NTF-018 | P1 | On All with 23 rows, scroll list to bottom twice. | Rendered rows grow 10 to 20 to 23; final load-more hint disappears; no paging request. |
| NTF-019 | P1 | Load more, then change type/search/tab. | Rendered limit resets to ten or remaining match count; selected keys are retained. |
| NTF-020 | P0 | Select one row, select a second, deselect both. | Bulk count progresses 1, 2, 1, 0; bulk bar disappears at zero; no read requests. |
| NTF-021 | P0 | With 18 filtered unread rows and ten rendered, check header checkbox. | All 18 selected, including eight offscreen items; bulk request coverage uses all selected IDs. |
| NTF-022 | P1 | Select category A rows; change to B; select/unselect B. | A selections persist while hidden; unselect-all affects only B. Bulk actions can still act on hidden selected A items. |
| NTF-023 | P0 | Select two unread rows; Mark as read; verify question and choose Yes. | Two read requests; Unread rows disappear; All retains them with read styling; unread badge decreases; selection clears. |
| NTF-024 | P1 | In All, select read and unread rows and mark read; repeat with only read rows. | Mixed selection sends requests only for unread IDs. Read-only selection clears without a dialog or requests. |
| NTF-025 | P0 | Parameterize Mark as read, Delete, Mark all read; choose No. | Correct question displayed; zero mutations; rows/counts preserved. Selected bulk actions retain selection. |
| NTF-026 | P0 | Select read and unread rows; Delete; choose Yes. | Delete request per selected ID; rows removed from All/Unread as applicable; badge recalculated; selection cleared; reload verifies persistence. |
| NTF-027 | P0 | Apply restrictive search/type filter; choose Mark all read and Yes on Unread. | Characterization only: DeleteNotification called for every loaded unread ID, including filtered-out/offscreen IDs; no read-status calls. Review R1 before acceptance. |
| NTF-028 | P1 | Mark all read on All; separately repeat on Unread with only read records loaded. | Characterization only: all loaded items deleted in both cases, even when Unread view is empty. Review R1. |
| NTF-029 | P1 | Return zero records; click Mark all read. | No confirmation or mutation requests. |
| NTF-030 | P1 | Complete read/delete; reopen dropdown and reload center using persisted/stateful data. | Mutated state remains consistent across surfaces; no resurrected deleted/unread rows. |

### Preferences, push, and resilience

| ID | Priority | Preconditions and steps | Assertions |
| --- | --- | --- | --- |
| NTF-031 | P0 | Fetch preferences for each permission profile. | Setting 1 available when returned; IDs 2–5 filtered by permissions; ID 6 has no visible toggle even with Inbox permission. |
| NTF-032 | P0 | Toggle setting 2/3/4/5 off then on in separate cases; reopen dialog. | Exact setting/property/user/staffName and isActive sent; state persisted; no push registration requested. |
| NTF-033 | P1 | Fail setting update with HTTP error. | Toggle returns to prior value; persisted state unchanged unless backend partially committed (see R7). |
| NTF-034 | P1 | Enable setting 1 with supported browser, granted permission, successful worker/token setup. | Token registration precedes setting enable; correct token context posted; toggle remains on. |
| NTF-035 | P1 | Enable setting 1 with permission denied/dismissed, token absent, or registration failure. | Toggle returns off; enable-setting request skipped; permission-required snackbar appears. Parameterize failure stages. |
| NTF-036 | P1 | Disable an enabled setting 1. | Setting update false sent; no token registration or permission prompt; preference remains off on reopen. |
| NTF-037 | P2 | Fail/delay GetNotifications or GetNotificationSettings. | Record current behavior: no dedicated error panel/retry control; failed list fetch does not replace cached data. Assess expected error UX under R5. |
| NTF-038 | P1 | Make one request in a bulk operation fail while another succeeds. | Observe partial server mutation; local success callback is not run. Reload reconciles persisted data. Report inconsistency; do not expect transaction rollback. |
| NTF-039 | P1 | Return HTTP 200 with mutation success flag false. | Characterization: UI currently applies success behavior anyway. Track as R4, not a passed business outcome. |
| NTF-040 | P2 | Render long text, punctuation, markup-like message text, zero/nonzero references, time boundaries. | Content remains usable; interpolation shows text rather than executing markup; reference visibility and relative times follow mapping rules. |
| NTF-041 | P0 | Live backend: read/delete as user A, inspect as user B; repeat with second property. | Verify per-user read/delete isolation and property scoping against actual retrieval; this cannot be established using frontend mocks. |
| NTF-042 | P2 | Live backend: execute each business event in section 2 with setting enabled, then disabled for all test-property users. | Matching event/content created when enabled; suppressed when disabled; refresh list to observe results. Validate each workflow's integration separately. |
| NTF-043 | P2 | Controlled push environment: receive foreground push and activate it. | Browser notification title/body/URL match payload/fallbacks; activation focuses/navigates. Keep native OS delivery checks separate from DOM tests. |

## 6. Locator and synchronization notes

Prefer accessible names where present and scope repeated controls to their surface or row. Existing useful targets are:

| Target | Locator basis |
| --- | --- |
| Header bell | Button with accessible name Notifications. |
| Dropdown | `app-notification-dropdown`; rows `.notification-item`. |
| Single read button | Within the target row, button named Mark notification as read. |
| Center navigation | Link named View all notifications. |
| Preferences gear | `app-notification-dropdown .gear-icon` (currently lacks an accessible button name). |
| Center | `.notification-center-page`; heading Notification Center. |
| Status buttons | Scope to `.status-tabs`; text Unread / All. Their accessible names also include icon text and counts; do not assume exact names or role=tab. |
| Search | Input with placeholder Guest, reservation, payment... |
| Type/sort controls | `.filter-bar app-setup-select`, first/second respectively; each wraps Material mat-select, not a native select. |
| Select options | Material overlay options by displayed text after opening the relevant select. |
| Center rows | `.notification-list-scroll .notification-row`, narrowed by unique title/message; row checkbox inside. |
| Select all | `.filter-bar app-setup-checkbox`, scoped to its native checkbox. |
| Bulk buttons | Scope Mark as read / Delete to `.bulk-actions`. |
| Confirmation | Application dialog containing exact question, then its Yes/No button. |
| Preferences toggle | `.preference-row` filtered by API-provided title, then its checkbox. |
| Preferences close | `app-notification-settings .cancel-close`. |

The controls have no notification-specific test IDs. If selectors prove ambiguous, add named labels/test IDs in a separate implementation change; do not use invented IDs in the suite. Avoid selecting rows by position when identifying mutation targets.

Wait for the relevant network response and observable UI change instead of fixed sleeps. Register request/response waits before the action. Layout and component initialization may both request the list, so do not require exactly one GetNotifications call per navigation. Native permission prompts and OS notifications are not DOM elements; cover application branching with a controlled browser/test seam and retain a separate real-push smoke test. Granting notification permission alone does not guarantee an FCM token.

Suggested future suite grouping:

- `notifications-dropdown.spec.ts`: NTF-001–011.
- `notifications-center.spec.ts`: NTF-012–030.
- `notification-preferences.spec.ts`: NTF-031–036.
- `notifications-resilience.spec.ts`: NTF-037–040.
- `notifications-integration.spec.ts`: NTF-041–043.

## 7. Review required before final acceptance tests

| ID | Finding | Testing decision |
| --- | --- | --- |
| R1 | Mark all read deletes; filters are ignored; empty Unread can delete already-read records. | Preserve evidence in characterization tests; establish intended read-vs-delete and scope behavior before writing acceptance assertions. |
| R2 | Badge caps only above ten, displaying 10 then 9+. | Confirm whether ten should also display 9+. |
| R3 | Selections survive filters/tabs and include offscreen rows. | Confirm intended bulk scope and make it explicit in tests. |
| R4 | Mutation success flags are ignored when HTTP status succeeds. | A false result must not be treated as proof of persistence; include reload/backend assertions. |
| R5 | Fetch/bulk error UX and partial-failure recovery are incomplete. | Record current failures separately from desired error handling. |
| R6 | Inbox preference hidden; archive, priority/source/property controls and row navigation are not exposed. | Do not write positive UI cases for these absent features. |
| R7 | Preference persistence occurs before activity-log insertion; a later log exception can return an error after the setting changed. | Re-fetch after failure in integration tests; UI rollback alone does not prove backend rollback. |
| R8 | Notification retrieval is delegated to an unavailable stored-procedure definition. | Validate preference delivery rules and per-user isolation against the deployed backend. |

## 8. Source references

Paths are relative to this document:

- [Notification service and API mapping](../PMSUI/src/app/modules/notification/services/notification.service.ts)
- [Dropdown logic](../PMSUI/src/app/modules/notification/component/notification-dropdown/notification-dropdown.component.ts) and [template](../PMSUI/src/app/modules/notification/component/notification-dropdown/notification-dropdown.component.html)
- [Center logic](../PMSUI/src/app/modules/notification/component/notification-center/notification-center.component.ts) and [template](../PMSUI/src/app/modules/notification/component/notification-center/notification-center.component.html)
- [Preferences logic](../PMSUI/src/app/modules/notification/component/notification-settings/notification-settings.component.ts) and [template](../PMSUI/src/app/modules/notification/component/notification-settings/notification-settings.component.html)
- [Header/layout integration](../PMSUI/src/app/shared/component/layout/layout.component.ts)
- [Route registration](../PMSUI/src/app/shared/shared.module.ts)
- [Access mapping and token registration](../PMSUI/src/app/core/services/auth.service.ts)
- [Firebase integration](../PMSUI/src/app/shared/services/firebase.service.ts)
- [API controller](../PMS.WebAPI/Controllers/NotificationController.cs)
- [Backend mutations, preferences, and notification creation](../PMS.Domain.Service/Managers/NotificationManager.cs)
- [Frontend tooling](../PMSUI/package.json)
