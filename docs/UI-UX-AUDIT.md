# BarkoLink UI/UX audit

Reviewed 6 October 2026. Stack: Vue 3, TypeScript, Ionic Vue, Tailwind/source-owned UI components, AG Grid Community, Capacitor, and Supabase.

This is an audit and proposed implementation guidance; application source was not changed. Findings marked **Browser** were reproduced using local, intercepted backend fixtures. **Source** findings follow directly from templates, styles, or flow logic. Proposed improvements are distinguished from observed failures. No hosted records, real accounts, payments, or notifications were changed.

## 1. System overview

BarkoLink covers the complete ferry journey through Passenger, Admin, Ticketing, and Boarding workspaces. It has a coherent maritime identity, useful reservation safeguards, and clear separation between cash payment, ticket issuance, check-in, and boarding. The main weaknesses concern task reliability and information visibility: receipt printing, keyboard access to payment confirmation, search behavior, missing sailing dates, and incomplete booking summaries. The responsive foundations are sound, but mobile operational pages put substantial content ahead of the next action, and the passenger-information step ignores the selected appearance.

Scores are reviewer judgments based on the available source and fixture browser review, not production usability metrics or a WCAG conformance certification.

| Area | Score / 10 | Assessment |
| --- | ---: | --- |
| Usability / Nielsen heuristics | 6.5 | Useful safeguards; preventable search, printing, and recovery problems |
| Visual hierarchy, spacing, typography, color | 7 | Cohesive identity; small supporting text and a forced dark step |
| Consistency | 6 | Several table, status, form, and navigation patterns |
| Navigation and information architecture | 6 | Role-specific menus; overlapping admin destinations and early authentication gate |
| Forms and inputs | 6 | Visible labels; inconsistent validation and insufficient field-level recovery |
| Accessibility / WCAG 2.2 AA readiness | 5 | Good focus baseline and QR alternatives; confirmed modal and contrast defects |
| Responsiveness | 7 | Three viewport sizes rendered; operational task placement needs improvement |
| Loading, empty, error, success states | 6 | Many good states; some loading/error situations resemble genuine emptiness |
| Content and microcopy | 6.5 | Payment guidance is useful; terminology and implementation jargon need cleanup |
| Role-based experience | 7.5 | Distinct workspaces and access checks; staff task speed can improve |

### System map

| Workspace | Pages/modules found |
| --- | --- |
| Public/authentication | Landing `/`; Sign in `/login`; Create account `/register`; Set a new password `/reset-password`; Privacy notice `/privacy`; landing sections How it works, Why BarkoLink, Port guide |
| Passenger | Home `/home`; Search `/search`, including `?all=1`; Trip details `/trip-details`; Passenger information `/passenger-info`; Review `/booking-summary`; Reservation confirmation `/booking-confirmed`; My bookings `/bookings` with Upcoming, Completed, Cancelled, Expired tabs; Booking details `/booking-details`; E-ticket `/ticket`; Notifications `/notifications`; Profile `/profile`; Saved travelers `/travelers`; Help `/help`; Settings and profile/password/appearance subpages |
| Admin | Dashboard; Bookings; Passengers; Trips & schedules; Trip operations; Fares & discounts; Ports; Routes; Accommodation; Vessels; Check-in; Boarding; Passenger manifest; No-shows; Travel advisories; Notifications/campaigns; Reports; Analytics; Users; Audit logs; Reservation settings; profile/password/appearance settings |
| Ticketing | Dashboard; Bookings; Walk-in booking; Passengers; Trips; Fares; Notifications; Account/Security/Appearance settings |
| Boarding | Dashboard; Active trips; Check-in; Boarding; Manifest; No-shows; Notifications; Account/Security/Appearance settings |
| Shared interactions | Trip search; port swap and passenger counter; saved-traveler picker; accommodation selector; advisory banners; payment countdown; grids with column visibility/filter/sort controls; mobile record cards; confirmation alerts; cancellation reason prompt; port maps/directions; theme switcher/previews |
| Forms/dialogs/exports | Port create/edit; vessel create/edit; sailing create/edit/reschedule/status changes; user creation/password generation/copy; booking/payment/ticket dialog; discount verification; cash-refund form; walk-in cash confirmation and receipt; QR/manual ticket lookup; route/accommodation editors; advisory editor; notification composer and audience confirmation; no-show reconciliation; report CSV; manifest CSV; ticket HTML download/share and browser print/PDF |

### Main user flows

1. **Passenger reservation:** Landing → sign in/register → Home search or browse departures → choose sailing → Trip details/accommodation → passenger details or saved travelers → review fare → confirm reservation → reference/payment deadline → cash payment at terminal → e-ticket → check-in → boarding.
2. **Passenger booking management:** Home/Bookings → reservation details → payment guidance or e-ticket → download/share/print; eligible unpaid booking → cancellation confirmation → Cancelled tab.
3. **Repeat traveler:** Profile/Home → Saved travelers → add/edit → next reservation → select saved traveler → choose fare category.
4. **Ticketing:** Sign in → booking queue → search reference/passenger/route → booking/payment dialog → verify discounted passengers → confirm cash collected → record payment and issue tickets. Operator cancellation → refund-pending record → cash returned → refund note and confirmation.
5. **Walk-in:** Ticketing → Walk-in booking → sailing/class → passenger details → discount verification if needed → review cash → confirmation → issue ticket → print receipt.
6. **Boarding:** Sign in → select sailing → scan QR or enter ticket code/search manifest → review passenger → confirm check-in → sailing opens for boarding → confirm boarded → progress/activity updated.
7. **Admin setup:** Ports/Vessels → Routes/Accommodation/Fares → create sailing → schedule/status management → Trip operations → manifests/no-shows/reports.
8. **Admin communications/accounts:** Advisories or notification audience → review/publish/send; Users → create account → generate/copy initial password; Audit logs → filter/read changes.
9. **Account recovery/preferences:** Sign in → send reset link → email link → new password → sign in; settings → save contact/profile, change password, or select Light/Dark/System.

### Nielsen heuristic coverage

The evaluation uses [Nielsen's ten heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).

| Heuristic | Existing strength | Improvement |
| --- | --- | --- |
| Visibility of system status | Payment deadline, boarding progress, saving labels | Distinguish loading/error from empty; show last successful queue refresh |
| Match with the real world | Cash collection, ports, passenger tickets | Use human-readable ticket states; standardize traveler/passenger labels |
| User control and freedom | Cancel/discard, booking edits, filters | Guard unsaved edits; make dialog exit and keyboard handling reliable |
| Consistency and standards | Shared brand/theme, role navigation | Unify grids, form validation, status labels, and appearance behavior |
| Error prevention | Fare recheck, duplicate reservation checks, confirmations | Birth-date validation; walk-in retry recovery; route/capacity constraints |
| Recognition rather than recall | Saved travelers, route/fare summaries | Keep dates, total due, selected sailing, and payment instructions visible |
| Flexibility and efficiency | Search, QR/manual lookup, CSV export | Server-wide record search; faster mobile review; preserve sailing context |
| Aesthetic and minimalist design | Clean cards and readable headings | Reduce repeated dashboards/titles; move task actions ahead of secondary content |
| Error recognition and recovery | Retry buttons and mapped errors | Field-specific correction links; actionable service errors; honest clipboard feedback |
| Help and documentation | Travel FAQ and ticketing guide | Public help and a concrete operator contact pathway |

## 2. Cross-system issues

Prioritize these shared fixes before redesigning isolated screens:

1. **Task outcomes can be misleading or incomplete.** A walk-in receipt is invisible in print media; header search can leave unchanged results; Copy can report success without clipboard access; booking details omit the fare total. Make successful outcomes observable and test the user-facing artifact, not just the button click.
2. **Appearance has exceptions that break the shared theme.** Passenger information declares dark colors locally regardless of preference. Replace local palette overrides with shared tokens; keep brand and error text legible on the actual surfaces.
3. **Record discovery changes between modules.** Bookings uses server search, most Admin directory searches filter the loaded page, AG Grid sorting/filtering is local, staff directories use explicit Search, and mobile cards remove grid sorting controls. Preserve one predictable search contract, with server queries for primary lookup tasks and clearly labeled optional page-local filters.
4. **Feedback patterns are inconsistent.** Routes/campaigns and some passenger pages have no distinct initial-loading branch; errors can coexist with empty-state guidance. Use a shared state pattern with loading, loaded-empty, loaded-results, failed-load, saving, and saved states.
5. **Keyboard and semantic navigation need a shared solution.** The custom walk-in dialog lacks focus handling; route navigation blurs focus without placing it on the new heading; page titles remain generic. Use accessible framework dialogs, route titles/focus, and consistent selected-state semantics.
6. **Content and status presentation vary.** Saved travelers versus Saved passengers, Trip versus Sailing, database vocabulary, enum text, and the admin Notifications bell leading to campaign composition add unnecessary interpretation. Create a small terminology/status map used across all roles.
7. **Supporting text is often too small.** Trip metadata, chart legends, advisory metadata, form hints, and table labels frequently use 9–12px. Increase decision-critical information to approximately 14px and essential controls/body copy to 16px where practical. Small text is a readability issue; it is not automatically a WCAG failure.

Accessibility findings use the [WCAG 2.2 reference](https://www.w3.org/WAI/WCAG22/quickref/). Normal text needs 4.5:1 contrast. WCAG AA minimum target size is 24×24 CSS pixels or an applicable exception; 44px is a sensible product target, not the AA minimum requirement.

## 3. Prioritized per-module findings

Effort: **S** = roughly half a day or less; **M** = 1–3 developer days; **L** = several days or broader cross-module work. These are estimates including appropriate validation. Individual quick wins are listed separately. No Critical severity was established by this review.

| # | Module/Page | Issue | Why it matters | Severity | Fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Ticketing → Walk-in → Print receipt | **Browser:** `.receipt` and its heading have `visibility:hidden` under print media. Global `body *` print hiding only restores `.ticket`; walk-in print CSS never restores receipt visibility. | Staff can issue a paid ticket and give the passenger a blank printout. | High | Restore receipt/descendant visibility in print mode, or use the shared standalone ticket document. Verify print preview and saved PDF. | S |
| 2 | Walk-in → Confirm cash payment | **Browser:** focus remains on the underlying Review cash payment button; Escape leaves the overlay open. Source has no focus trap or focus restoration. | Keyboard users cannot reliably operate a financial confirmation; focus can reach obscured controls. | High | Replace the custom overlay with Ionic Modal or Reka Dialog; label it, focus Go back initially, trap focus, make background inert, restore trigger focus. | M |
| 3 | Admin → header search while on Bookings | **Browser:** submitting changes the URL to `?search=missing-reference`, but the local search stays empty and RPC search remains `""`. Only section changes synchronize the query. | A frequent lookup action appears successful while showing unrelated reservations. | High | Watch `route.query.search` and synchronize search/page; retain the existing debounced server query. Test same-page and cross-page submission. | S |
| 4 | Search → Browse departures `/search?all=1` | **Browser/Source:** `TripCard` accepts `date` but never displays it; the all-departures header only says Upcoming departures. | Passengers cannot distinguish otherwise similar sailings on different days without opening each one. | High | Add departure date to every card; group multi-day results by date; preserve route/date/count context. | S |
| 5 | Passenger information `/passenger-info` | **Browser/Source:** local `.passenger-info-page` palette and `color-scheme:dark` force a dark page in Light mode. The white toolbar inherits near-white brand text. | Abrupt appearance change and poor brand contrast break consistency during the booking task. | High | Remove local palette overrides; use inherited surface/text tokens and the resolved theme. Check all booking steps in Light/Dark/System. | S |
| 6 | Booking confirmation, My bookings, Booking details | **Source/Browser:** reservation confirmation stores a total but does not display it; booking cards/details omit a clear total due/paid and passenger-fare breakdown. | Passengers returning to pay have to recall the checkout amount; refund and fee information is harder to reconcile. | High | Persistently show total due/paid, class fee, status, deadline, and payment location/instructions. Start with Booking details and confirmation. | S |
| 7 | Admin Passengers/Trips/Users/Check-in/Boarding/Manifest | **Source:** primary search/status/sailing filters run against the loaded page of 30; the footer acknowledges this. | A valid person or trip on another page can look absent. Sailing selection is also limited by the separately loaded trip page. | High | Send primary filters/sailing to the RPC and reset page; provide search across all sailings. Label optional grid filters as loaded-page filters. | M |
| 8 | Passenger dates/times; walk-in schedule | **Source:** Search time filters use Asia/Manila, while card clocks, booking date/time formatting, confirmation, and walk-in display omit explicit timezone. Admin/Boarding use Philippine time. | Overseas travelers can see a different departure hour or date from terminal staff. | High | Use one explicit Philippine-time formatter throughout; show PH time once per schedule context. Test from a second browser timezone. | S |
| 9 | Active Admin navigation; manifest Export button | **Source + contrast calculation:** white on `#2196f3` is 3.12:1; white on Export's `#238fe0` is 3.46:1, below 4.5:1 for their small text. | Navigation/actions become harder to read and miss normal-text AA contrast. | High | Use the existing darker action token; assess all state/theme combinations. `#156bc1` with white is approximately 5.38:1. | S |
| 10 | Home, My bookings, Booking details, Notifications; Routes/Campaigns | **Source:** empty sections can render before load completes; ticket view has distinct loading/error states but sibling views do not. | Slow or failed loading can be mistaken for missing reservations or notices. | High | Gate empty states on completed successful loading; show skeleton/status and targeted Retry. Keep previous records clearly marked during refresh if desired. | M |
| 11 | Passenger information form | **Source:** birth date has no max/min; confirmation checks required presence, unlike Travelers and Walk-in which reject future dates. | Users can reach review with obviously invalid dates and receive late errors or inconsistent data handling. | High | Share birth-date and name/contact validation; add `:max="manilaDay()"`; identify passenger/field and return focus to its correction. | S |
| 12 | Passenger → My bookings → Completed | **Source:** “Completed” includes any non-cancelled/non-expired booking whose departure time has passed, without checking sailing completion. | Delayed or currently sailing journeys can be described as completed. | Medium | Rename the tab Past departures, or classify by actual sailing/arrival status and retain In progress. | S |
| 13 | Booking review summary | **Source:** review shows name/type/phone but not birth date, sex, or nationality, though these are collected for each passenger. “Done” appears even after direct navigation with an incomplete draft. | Users cannot review all submitted identity details; the completeness cue is misleading. | Medium | Add expandable passenger details and validate entry to review; replace Done with a real completion state. | M |
| 14 | Walk-in ticket retries | **Source risk; Needs verification:** each `issueTicket()` attempt creates a fresh booking reference, guest UID, and ticket code. | A successful server write followed by a lost response could be retried as a different cash sale. | High | Keep a stable sale intent until confirmed outcome; recover by reference before reissuing. Simulate response loss against isolated backend tests. | M |
| 15 | Walk-in on phone | **Browser/Source:** a large, initially PHP 0 Counter summary is ordered before the Choose a sailing form; at 390px the selector is near the bottom of the first viewport. | Staff must scroll past an uninformative summary to start a counter sale. | Medium | Put Step 1 first; show a compact sticky payable summary once selected; leave the full summary for final review. | S |
| 16 | Boarding on phone/tablet | **Browser/Source:** the review panel follows the whole manifest; selecting a passenger only updates its ID. | Reviewing/processing someone near the top of a long manifest can require scrolling past every other passenger. | High | Open a labeled review sheet or move/focus/scroll to the review panel after selection. Keep name, sailing, and action visible together. | M |
| 17 | Admin Manifest; Boarding Manifest | **Source:** standalone Admin manifest sends users to Reports for download; a manifest export component already exists in Reports and Trip operations. Boarding Manifest has no export action. | A manifest task is spread across pages, with role capabilities unclear. | Medium | Add authorized export directly to Admin Manifest, retaining sailing selection. Confirm whether boarding staff should also export. | S/M |
| 18 | Admin Dashboard / Analytics / Reports / Trip operations | **Source:** Dashboard and Analytics render the same overview component; operational modules repeat Trip operations tabs. | Users have to decide between overlapping destinations; long navigation buries infrequent management tasks. | Medium | Use Dashboard for current exceptions/actions, Reports for historical analysis, and Trip operations as the selected-sailing hub; group setup pages. | L |
| 19 | Admin Notifications bell | **Source/Browser:** the bell opens Notifications, whose task is sending campaigns rather than reading the admin's inbox. Header search placeholder mentions passengers while destination is Bookings. | Familiar controls suggest different destinations/actions from those delivered. | Medium | Relabel campaign page Broadcasts/Announcements; offer actual inbox separately. Label header search Search bookings unless expanding its scope. | S/M |
| 20 | Trip operations and Travel advisories | **Browser:** parent and child repeat headings and Refresh actions. | Repetition consumes mobile space and creates two equivalent controls. | Low | Keep one page heading and one refresh action; retain component headers only when embedded elsewhere. | S |
| 21 | Route editor / Accommodation editor | **Source:** Route editor offers identical origin/destination until submission; class capacity input gives no vessel remaining-capacity hint or bound. | Avoidable invalid submissions require server round-trips and trial-and-error setup. | Medium | Validate distinct ports locally; show remaining capacity and disable invalid save, with server rules retained. | M |
| 22 | Routes / Accommodation / Campaign history / Reports | **Source:** these native tables have different controls from RecordsGrid; below 700px RecordsGrid hides desktop sorting and columns tools. | Staff lose familiar ways to inspect records when changing module/device. | Medium | Define shared table controls and mobile sort/search; use RecordsGrid where it fits and consistent shells around report tables. | M |
| 23 | Saved travelers and booking reuse | **Source:** saved form defaults Sex to MALE; saved option OTHER is converted to Prefer not to say in booking. Picker failures silently hide the control. | Defaults can record an unintended answer; different answers are conflated; repeat users do not know why saved details disappeared. | Medium | Use an explicit placeholder and shared values; preserve Other separately if supported; show a nonblocking saved-list retry message. | M |
| 24 | Saved travelers → Edit | **Source:** editing calls `window.scrollTo`, although the form sits inside Ionic's scroll container. **Needs verification** with a long list. | Edit may populate an offscreen form without revealing where to continue. | Medium | Scroll the actual IonContent container and focus the edit heading/name field. | S |
| 25 | Reports → Passenger mix | **Source:** breakdown is fixed to regular/student/senior/child/pwd/pregnant although fare configuration supports arbitrary renamed/new discounts. | New categories can be absent from the breakdown. Totals and category sums need verification using a custom-discount fixture. | Medium | Return/render dynamic category counts, or include a clearly labeled Other category. | M |
| 26 | Dashboard volume chart; report collection chart | **Source:** dashboard bars expose exact values through hover titles/overall image label but lack visible scale/values; report bars are buttons with no action. | Precise comparison is hard; nonfunctional chart buttons add keyboard stops. | Medium | Add scale/value labels and an expandable data table. Use focusable controls only for actual interactions. | M |
| 27 | Reservation settings | **Source:** after a failed initial settings load, the default 24 hours remains and Save becomes enabled; `save()` does not require successful loading. | An admin may overwrite an unknown saved value using a fallback presented as editable data. | Medium | Track loaded state, show Retry, and disable saving until the current setting is loaded. Offer explicit presets plus a custom duration. | S |
| 28 | All SPA routes | **Browser/Source:** generic document title on every tested route; router blurs focus but does not move it to the new page heading. Booking status uses tab roles without tabpanel/arrow-key handling. | Keyboard/screen-reader navigation has weak orientation and incomplete widget semantics. | Medium | Set per-route titles; focus the entering visible page heading; use Reka tabs or ordinary pressed filter buttons as appropriate. | M |
| 29 | PaymentDeadline in My bookings | **Source:** a `role="status"` contains a countdown updating every second. **Needs verification** with screen readers. | Frequent announcements may interrupt reading, multiplied across unpaid bookings. | Medium | Keep the ticking countdown out of live regions; announce meaningful urgency thresholds and expiry once. | S |
| 30 | Auth, Help, Privacy | **Source:** search and Help are protected routes; public Find a sailing redirects to login, and help/privacy give no actual operator phone/email/support link. | Visitors must authenticate before evaluating departures or payment rules; users with a problem cannot reach a concrete contact route. | Medium | Make schedule browsing/help public with reservation protected; supply configured operator contacts and a reference-aware help action. | M |
| 31 | Forms and error messaging | **Source:** most custom errors are page-level rather than linked to fields; raw database messages and migration/.env instructions can reach product screens. | Users must locate the incorrect field and cannot act on developer instructions. | Medium | Use field errors with `aria-invalid`/`aria-describedby`, an error summary, and user-actionable service text; keep diagnostics in logs. | M |
| 32 | Confirmation Copy; refunds; notifications/ticket states | **Source:** optional clipboard call can still show Copied when unavailable; refund confirmation says Confirm cash received after asking whether staff returned cash; labels include Updating? and Preparing QR code?. | Feedback can be false or ambiguous at important moments. | Medium | Handle clipboard failure explicitly; say Confirm cash returned; replace accidental question marks and map enums to readable text. | S |
| 33 | Profile/settings and editor navigation | **Source:** profile/fare drafts have some preservation/discard handling, but no shared route-leave guard protects editors across the app. | Navigating away can discard longer route, advisory, passenger, or account edits unpredictably. | Medium | Standardize dirty-state handling, save/discard confirmation, and owner-scoped draft retention where suitable. | M |

## 4. Quick wins: ten fixes estimated under one hour each

These are narrowly scoped edits with a focused check, not promises that an entire cross-system remediation fits in an hour.

| Priority | Fix | Estimate | Verify |
| --- | --- | --- | --- |
| 1 | Restore `.receipt` and descendant visibility in print CSS | 20–40 min | Simulated sale → print preview/PDF includes name, fare, reference, ticket code |
| 2 | Synchronize Admin header search with `route.query.search` | 30–50 min | Header search from Bookings updates input and RPC query |
| 3 | Display `trip.date` on TripCard | 15–25 min | Two dates with identical routes/times remain distinguishable |
| 4 | Remove Passenger information's forced dark palette | 30–50 min | All booking steps follow Light/Dark/System |
| 5 | Display `currentBooking.total` in Booking details | 15–30 min | Paid/unpaid details show the correctly labeled amount |
| 6 | Add a Philippine-day max to booking birth date | 15–25 min | Tomorrow is rejected; valid older dates accepted |
| 7 | Replace active admin navigation blue and manifest-export blue with accessible action token | 15–30 min | Computed normal-text contrast reaches 4.5:1 |
| 8 | Correct Confirm cash received → Confirm cash returned; Updating?/Preparing QR code? punctuation | 10–20 min | Refund direction and busy state are unambiguous |
| 9 | Relabel Admin header placeholder to Search bookings | 5–10 min | Scope matches destination and accessible name |
| 10 | Rename Saved passengers in Profile to Saved travelers | 5–10 min | Home, Profile, Help, picker, and destination use the same term |

## 5. Strategic roadmap

### Phase 1 — Now: restore reliability and essential information

Fix findings 1–11 first, plus the mobile boarding review action. Implement one accessible payment-dialog pattern, correct receipt printing, route-query search, appearance inheritance, explicit Philippine time, date visibility, and total due/paid. Then repair loading/error/empty states for reservation pages and server-search behavior for operational directories. Verify retry outcomes and shared theme contrast before operational release.

Acceptance checks: print/PDF is nonblank; keyboard-only walk-in confirmation works and returns focus; header search works from the same page; records beyond page 1 are searchable; dates/times agree across browser timezones; Light preference survives the entire reservation flow; a failed load never says there are no bookings.

### Phase 2 — Next: reduce task time and unify patterns

Standardize record tables/mobile sorting, status/terminology maps, field-level validation, dirty-state handling, route titles/focus, and consistent help access. Move mobile boarding review into a sheet, put walk-in sailing selection first, add manifest export at the point of use, and preserve selected-sailing context between pages. Add dynamic fare-category reporting and chart data tables.

Measure reservation completion, errors per passenger form, time to find a booking, time to issue a walk-in ticket, and scan-to-board time. Establish a baseline before setting numeric improvement targets.

### Phase 3 — Later: consolidate architecture around tasks

Consolidate overlapping admin Dashboard/Analytics/Reports destinations and make Trip operations the sailing hub. Explore a wider desktop passenger layout only if desktop traffic and task testing justify it; the current compact canvas is an intentional product choice, not a rendering defect. Validate guest browsing, native ticket sharing/printing, unstable connectivity, and larger manifests with representative users and devices.

Do not replace the stack. Reuse Ionic/ Reka for accessible dialogs, existing design tokens for appearance, AG Grid plus shared mobile controls for directories, and secured Supabase RPCs for filtering and state changes.

## 6. What is working well

- Clear role-specific navigation and routing, backed by separate authorized database operations in the source.
- Reservation confirmation rechecks live fares and seat/class availability, detects duplicates, and retains a reference for passenger retries.
- Payment, issued ticket, checked-in, and boarded states are distinct; staff actions include confirmations and disabled-state explanations.
- Boarding supports QR scanning and manual code lookup and stops the camera when leaving the view.
- Saved travelers and accommodation choices help repeat/group booking.
- PaymentDeadline, notices, refund instructions, and travel FAQs explain the cash-based operating model.
- Shared tokens, brand, cards, theme persistence, system-theme response, global visible focus, and large passenger input/button targets provide a useful foundation.
- AG Grid gives desktop sort/filter/column controls; mobile directories render record cards.
- Ticket download embeds its QR image in a standalone HTML artifact, avoiding external dependencies; QR text is also available when an image cannot load.
- Audit records display readable change descriptions and clarify the limitations of older actor-role data.
- Fixture tests cover all four workspaces at 1440, 768, and 390px and include useful state, sorting, theme, and form checks.

## 7. Not reviewed / needs verification

### Review evidence and limits

Mapped every registered route and reviewed the active page/module templates, relevant script behavior, shared controls, palettes, navigation, data presentation, and supporting flow helpers. Browser rendering used local synthetic sessions/data and intercepted Supabase requests. The existing `verify-experience-ui.mjs` passed all four roles at desktop/tablet/mobile widths. Supplementary `.audit/ui-audit.mjs` rendered the otherwise omitted port/vessel/manifest/check-in/boarding/report and booking-flow/walk-in pages at those widths. `.audit/print-audit.mjs` reproduced hidden receipt printing, retained background focus, and absent Escape dismissal using a simulated sale.

Public landing/authentication/registration/privacy checks passed their desktop/mobile portion in `verify-ui.mjs`. That script's later legacy workspace portion failed because its fixture does not handle `AdminOverview`; that is a test-fixture limitation, not evidence that Admin Dashboard fails. The newer experience suite passed. No production build, unit suite, hosted database write, or live email/reset flow was run as part of this UX audit.

### Not reviewed

- Real production accounts, permissions under real tokens, production records, live payments/refunds, and operator workflow compliance.
- Native Android/device camera, hardware scanners, printers, installed-app sharing, and device file-opening behavior.
- Actual delivery/expiry behavior of confirmation/reset emails. Reset Password was reviewed from source; the complete recovery flow was not exercised.
- Google Maps location accuracy and real terminal/gate assignments. Embedded-map switching and direction-link construction were checked; operator location data was not verified.
- Physical printed output and real printer settings. Browser print-media visibility was verified.
- Real users, analytics, task-frequency data, and usability sessions.
- Complete backend/security/schema correctness, third-party framework internals, generated/native build artifacts, or archived prototypes. Supporting database code was inspected only where needed to understand visible UX.

### Needs verification

- WCAG conformance with NVDA/TalkBack/VoiceOver, full keyboard navigation, 200% text resizing, 400% zoom/320px reflow, target spacing, contrast across every error/status/theme, and native accessibility. Existing CSS declares 44px passenger controls; a blanket claim that all touch targets are too small would be incorrect.
- Walk-in server success followed by response loss, idempotent retry behavior, and reconciliation before another cash sale.
- Long lists and large data: mobile boarding review placement, saved-traveler edit scrolling, server pagination/filter combinations, completed sailing context, and staff manifest permissions.
- Reports with paid/refunded/cancelled/custom-category fixtures at meaningful volume. The supplementary report browser check used empty data; the render and source were reviewed, but financial correctness was not established.
- Expired/cancelled/failed-load booking and queue states under controlled failures; clipboard denied/unavailable cases; missing QR/unsupported sharing paths; concurrent staff updates.
- Operator policy for per-passenger phone requirements, permitted sex values, advance check-in, deadline behavior, and the right support contacts.

## 8. Before/after snippets for top fixes

These are proposed changes, not applied patches. Keep server-side validation and authorization. Snippets show the relevant replacements; imports and surrounding state should be integrated with the existing page.

### A. Walk-in receipt printing

Before — `src/theme/variables.css` and Walk-in's print CSS:

```css
@media print {
  body * { visibility: hidden; }
  body .ticket, body .ticket * { visibility: visible; }
}
/* Walk-in receipt styles set layout but never restore visibility. */
```

After — add to shared print styles or an equivalently specific receipt print block:

```css
@media print {
  body .receipt, body .receipt * { visibility: visible; }
  body .receipt {
    position: absolute;
    inset: 0 auto auto 0;
    width: 100%;
    color: #172033;
    background: #fff;
  }
  body .receipt-actions { display: none; }
}
```

For longer receipts, verify Ionic scroll-container pagination or use the standalone ticket export approach.

### B. Accessible walk-in cash confirmation

Before — `TicketingWalkInPage.vue`:

```vue
<div v-if="confirming" class="confirmation-overlay">
  <section role="dialog" aria-modal="true">
    <!-- No focus handling; background controls remain focusable. -->
  </section>
</div>
```

After — reuse the existing shared Ionic confirmation helper and remove the custom overlay:

```ts
import { confirmAction } from "../../../composables/confirmation";

async function prepareTicket() {
  // Retain the existing sailing/passenger/discount validation here.
  const accepted = await confirmAction({
    title: "Confirm cash payment?",
    message: `Confirm you received PHP ${payable.value.toLocaleString()}
      from ${form.passengerName} for this sailing.`,
    confirmText: "Cash received — issue ticket",
  });
  if (accepted) await issueTicket();
}
```

If Go back must be initially focused, or the confirmation needs rich review content, use Ionic Modal/Reka Dialog with explicit initial focus. Verify focus trapping/restoration in the framework integration; migrating alone is not an accessibility certification.

### C. Admin header search on the current page

Before — `AdminWorkspacePage.vue`:

```ts
watch(section, () => {
  recordPage.value = 0;
  search.value = String(route.query.search || "");
  void loadData();
});
```

After — retain section handling and add query synchronization:

```ts
watch(() => route.query.search, value => {
  if (!isWorkspaceRoute.value || section.value !== "bookings") return;
  recordPage.value = 0;
  search.value = typeof value === "string" ? value : "";
  // Existing watch([search, statusFilter]) schedules the server reload.
});
```

### D. Date visibility and Philippine time

Before — `TripCard.vue` and `SearchPage.vue`:

```vue
<small>Trip {{ trip.id }} | Passenger ferry</small>
```

```ts
new Intl.DateTimeFormat("en-PH", {
  hour: "numeric", minute: "2-digit", hour12: true,
}).format(new Date(value));
```

After:

```vue
<small>{{ trip.date }} · Trip {{ trip.id }}</small>
```

```ts
new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric", minute: "2-digit", hour12: true,
}).format(new Date(value));
```

Apply the same explicit timezone to passenger date/confirmation and walk-in formatters; do not merely add a PH label to browser-local times.

### E. Respect Light/Dark/System in passenger information

Before — `BookingFlowPage.vue`:

```css
.passenger-content { --background: #0d1726; }
.passenger-info-page {
  --surface: #142235;
  --ink: #eff6fb;
  /* Further unconditional dark palette overrides. */
}
.passenger-info-page .form-grid input { color-scheme: dark; }
```

After — remove local palette declarations and hardcoded dark autofill styling:

```css
.passenger-content { --background: var(--page-background); }
.passenger-info-page {
  min-height: 100%;
  background: var(--page-background);
  color: var(--ink);
}
.passenger-info-page .form-grid input,
.passenger-info-page .form-grid select {
  background: var(--surface-soft);
  color: var(--ink);
  border-color: var(--line);
  color-scheme: inherit;
}
```

### F. Make the booking amount visible

Before — Booking details displays route, reference, sailing, and passengers without a total.

After — `PassengerRecordsPage.vue`, inside the detail card:

```vue
<dl class="booking-payment-summary">
  <dt>{{ currentBooking.paymentStatus === 'PAID'
    ? 'Total paid' : currentBooking.paymentStatus === 'REFUND_PENDING'
      ? 'Refund pending' : currentBooking.paymentStatus === 'REFUNDED'
        ? 'Total refunded' : ['CANCELLED', 'EXPIRED'].includes(currentBooking.status)
          ? 'Original booking total' : 'Total to pay' }}</dt>
  <dd>PHP {{ currentBooking.total.toLocaleString('en-PH') }}</dd>
</dl>
```

For the complete improvement, include fare/class breakdown and a clearly labeled PHP 0 booking fee; keep cancelled/expired states from implying payment is due.
