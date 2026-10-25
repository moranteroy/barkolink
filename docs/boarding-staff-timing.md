# Boarding staff: per-trip boarding time

Boarding staff can use **Adjust time** beside the selected sailing's boarding start in Dashboard, Check-in, Boarding or Manifest. Enter the lead time in minutes/hours, review the Philippine-time preview, and provide a reason. This creates a trip-specific override; Admin retains operator-wide defaults and trip departure/status administration.

The database enforces the permission on both reads and writes. Staff must have an active assigned port matching the trip's departure port. Ticketing, Passenger and anonymous callers are rejected; the existing MFA gate still applies. Admin can also use the trip operation.

Adjustments require a Scheduled/Boarding trip whose departure has not passed. Boarding must start from one minute to seven days before departure. A trip already Boarding cannot be given a future boarding start; Admin must delay/reschedule when operations need to pause. Closed/cancelled/delayed/departed trips cannot be adjusted here. Existing automatic status processing uses the saved override on its next minute cycle.

Every successful change records `BOARDING_TIME_UPDATED` in Audit Logs with the trusted actor/role, trip, reason and previous/new effective boarding times. The current trip version is required, so another edit or a reschedule cannot be overwritten by a stale dialog. Reloading details preserves the proposed duration and reason for review before retrying. Queue auto-refresh pauses while the editor is open.

## Installation

Migration: `supabase/migrations/048_boarding_staff_trip_timing.sql`. New-project `supabase/setup.sql` includes it. For an existing configured project:

```powershell
node scripts/apply-boarding-staff-timing.mjs
node scripts/apply-boarding-staff-timing.mjs --apply
```

The first command inspects function metadata only. `--apply` backs up the current dispatcher definition, installs the wrapper transactionally, checks that existing records/operator policies are unchanged, refreshes the schema cache and verifies private functions remain inaccessible directly. It does not adjust a real trip. A successful installation writes `.audit/boarding-staff-timing-migration.json`; deployment status must be confirmed from that receipt rather than inferred from local source.

Migration 048 was installed and verified on the connected Supabase project on October 24, 2026. The receipt confirms the operation is available and authenticated/anonymous callers cannot bypass the dispatcher through either private wrapper. The existing-data fingerprint check passed during installation.

## Validation

- Full isolated database suite passed, including six new tests covering assigned-port restrictions, denied roles, MFA, default-policy protection, validation, audit identity/details, stale edits, closed trips and the existing automatic transition.
- Thirteen focused unit tests passed, including four new editor tests for hours conversion, reason validation, retry/version recovery and unavailable/closed trips.
- Production build and postbuild security-header check passed; lint passed for changed application/unit files and the deployment helper.
- Browser fixtures verified real saves/conflict recovery at 1440/390px in light/dark with an overseas browser timezone. These UI checks intercept backend requests; database tests establish actual authorization behavior.
