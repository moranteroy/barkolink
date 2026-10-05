# Existing features across all roles

4 October 2026. Comparison uses the active Vue/Ionic application and the React source sections in `base44/base44.txt`. The reference's profile and many menu actions are prototype navigation; the improvements below use the main application's actual services.

| Existing feature | Base44 reference | Previous main behavior | Main improvement |
| --- | --- | --- | --- |
| Passenger profile | Identity card and grouped Account/System/Legal links | `/profile` redirected to a settings form; no central profile hub | Dedicated `/profile` with actual name, email, initials, contact summary, grouped working destinations and real sign-out |
| Profile navigation | Saved passengers, security, help and notifications are discoverable from profile | Travelers/help were home shortcuts; header went directly to editing | Header and bottom Profile tab open the hub; profile links to travelers, bookings, personal details, password, notifications, appearance, help and privacy |
| Profile editing | Most reference links return to `/profile`, without an actual persistent editing implementation | Separate database and Auth mutations could partially succeed; load ran only on mount; Save could run before successful load | One transactional server save; name/contact validation; loading/retry; save gating; duplicate-submit guard; retained failed drafts; Discard changes; safe refresh on reentry |
| Identity consistency | Sample identity from development role context | Database name and session display name could differ after failed updates | Server updates trusted account's Auth display name and application profile together; visible session name updates after success; role checks refresh current account details |
| Security settings | Profile menu link is a placeholder | Password, profile and theme were all rendered on every settings route | Each subsection has its own focused view; active navigation, password reveal, reauthentication, same-password rejection, duplicate-submit protection and clearing password fields on entry/unmount |
| My bookings | Status navigation and explicit booking-detail access | Lifecycle tabs existed, but booking cards did not consistently expose the detail screen | View details on every booking; search reference, route, vessel and passenger; payment-status filter; clear-filter recovery with an accurate empty-state message |
| Reservations | Mock countdown | Stored deadline shown as text | Existing unpaid reservations show a countdown from the database deadline and refresh authoritative status at expiry |
| E-ticket | Per-passenger ticket design, placeholder QR, inactive export controls | Real issued ticket values, externally generated QR images, no export controls | Local real QR encoding, standalone offline download, print and supported file sharing |
| Notifications | Category tabs and Mark all read | Owner records with individual mark-read | Category filters, unread count and owner-scoped bulk mark-read |
| Sailing search | Inline search editing and time chips | Route/date/passenger search and departure ordering | Inline Modify search, morning/afternoon/evening filters in Philippine time and retained departure ordering |
| Saved passenger entry | Sample saved passenger selector | Session-scoped booking draft | Persistent account-owned saved travelers with working management and passenger prefill; fare eligibility remains booking-specific |
| Admin records | Mobile stacked cards | Horizontally scrolling tables | Labeled mobile cards with existing actions, preserving desktop tables |
| Admin account | Profile/security navigation in role menus | Admin settings offered appearance only; header identity was inert | Own profile and password forms, dedicated subsections and clickable header account; saves use the same transactional operation |
| Admin booking search | Unified reservation search/status controls | Search and status filtered only the fetched page | Existing server search/status are now used across all reservations; changing filters resets pagination; stale responses cannot overwrite newer results |
| Ticketing navigation | Active workspace destinations and identity menu | Overview always appeared active; identity chip had no destination | Active section follows navigation; account chip opens Ticketing account settings |
| Ticketing queue | Reservation list and recent reservations | Refresh could repeat during loading; refresh failures cleared visible queues | Visible refreshing state, gated paging/refresh and retained last successful records on failure; recent reservation timestamps retain their actual meaning |
| Ticketing and Boarding contact | Staff account panel | Unvalidated phone, no retry/discard, drafts overwritten on entry | Validated normalized contact number, load retry, discard, disabled in-flight editing and retained failed drafts on reentry |
| Ticketing and Boarding security | Dedicated security view | No duplicate submission guard, reveal control or same-password check | Current-password verification, minimum length and same-password validation, duplicate protection, reveal toggle and cleared sensitive fields |
| Boarding manifest | Search, state tabs and passenger review | Search/state could lead to an empty view with manual recovery | Clear filters restores the selected sailing's manifest; identity chip opens Boarding account settings; existing gate validation remains authoritative |
| All-role light appearance | Exact palette and card styles in reference `src/index.css` | Radial page gradients and translucent panels | Reference HSL background/ink/blue/border tokens, opaque white cards, subtle shadows and consistent typography across roles; explicit Light/Dark settings also control Ionic's palette |

## Role workflow review

Passenger: sailing search, passenger entry and saved travelers, reservation summary/deadline, booking history/details, tickets, notifications and account/security/help were compared. The existing transactional booking flow remains in use; its discovery, filtering and export controls were improved.

Admin: bookings, passengers, trips, per-trip operations, fares, ports, vessels, check-in, boarding, manifest, analytics, accounts and settings were compared. The prototype's sample reports are not live analytics: the main reports keep their actual database calculations. Existing fare snapshots, overlap prevention and staff permission enforcement remain in use. Trip operations, advisories, no-show reconciliation, mobile records, global booking search and own-account settings now use real services.

Ticketing: reservation search/payment, passenger discount verification, guest walk-ins, refunds, navigation and account/security were compared. Cash collection, issuance and discount verification already have persistent server rules; the changes improve queue navigation/loading and working account controls around those workflows.

Boarding: selected sailing, manifest search/status, ticket lookup/camera, passenger review, check-in/boarding progress, gate history and account/security were compared. The main application's real scanner and confirmed state transitions remain in use. Filter recovery and account navigation are improved without copying the prototype's simulated scanning results.

The reference's accommodation inventory and linked return-trip booking require additional inventory and transaction design; they have not been introduced as decorative controls. Admin passenger/trip/user list filters still apply to the current page and are labeled accordingly; only booking search/status now span the server records.

## Profile data and behavior

`/profile` is an account overview. `/settings/profile` edits name and contact number; email remains read-only. `/settings/password` changes the password after current-password verification. `/settings/appearance` changes the local theme. Saved passenger details remain under `/travelers` and are distinct from the account holder's profile.

The reference's Emergency Contact, Booking Preferences, Policies and About menu labels do not constitute implemented persistent features. The hub presents destinations that work with the current system and links to its actual privacy notice and help guidance. It does not invent emergency-contact data, operator policies or stored booking preferences.

Profile name/contact changes use the existing `UpdateMyProfile` RPC with migration 010. It updates Auth display-name metadata and the application profile within one transaction. The caller cannot target another account or alter email, role or other metadata through this operation. Validation happens both in the client and on the server. Phone numbers allow 7–15 digits with an optional leading `+`; spaces, parentheses and hyphens are removed. A blank phone clears the optional contact number.

Unsaved edits survive a failed save and a cached-page reentry; Discard changes restores the last successfully loaded/saved values. Successful reentry refreshes the profile when there is no unsaved draft. The save controls remain disabled when profile loading failed.

## Validation and deployment

Profile tests cover load failure/retry, validation, one save despite duplicate submissions, failed-draft retention, discard, reentry refresh, dedicated security controls, working profile destinations and logout. Database tests cover ownership, metadata preservation, role/email immutability and rollback of Auth identity if the profile write fails. Browser checks exercise profile saving, reload persistence, return-to-profile navigation and mobile layouts using intercepted fixtures rather than real accounts.

Migration 010 is additive to migration 009 and edits no existing account data during installation. New setups include ten migrations in `supabase/setup.sql`. Existing installations apply only `010_atomic_profile.sql` once. The management script's `upgrade-profile` mode checks whether it is already installed.

Migration 010 was applied successfully to the configured hosted project on 4 October 2026. Final checks passed: production build, lint, 96 unit tests, 29 database tests, and desktop/mobile browser checks for all four roles. Browser checks intercept backend requests and exercise Admin profile editing and server search/status arguments, Ticketing navigation, Boarding filter recovery, staff phone persistence and password reveal, and Light/Dark palette switching. Hosted smoke checks passed without creating test accounts or bookings. Screenshots are in `docs/screenshots/experience/`.
