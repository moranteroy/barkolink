---
name: barkolink-ui
description: Audit and improve BarkoLink UI across Passenger, Admin, Ticketing, and Boarding, especially the shared AG Grid tables, mobile records, forms, and light/dark themes. Use for work in the BarkoLink Vue/Ionic codebase.
---

# BarkoLink UI

Improve the current ferry booking and terminal workflows using the project's existing components and blue maritime identity. Resolve the requested scope: a review produces findings; an implementation request produces code and relevant verification.

## Orient to the current source

Locate the app through `package.json` and `src/router/index.ts`; it may be the current directory or the nested `barkolink/` folder. Read applicable `AGENTS.md` and inspect working-tree changes before editing.

Read [the codebase map](references/codebase-map.md) for the affected role and shared foundations. When changing records, read [the AG Grid guide](references/ag-grid.md). The October 24 audit is a useful baseline at `docs/UI-UX-AUDIT-2026-10-24.md`; verify its findings against current source before repeating them.

## Make the workflow easier to use

- Identify the role's immediate task and give it one clear primary action: passenger booking/payment/ticket, ticketing reservation review/counter sale, boarding ticket lookup/attendance, or admin record management.
- Reuse `Button`, `Badge`, `Card`, `Skeleton`, `RecordsGrid`, `WorkspacePagination`, `QueueFreshness`, `BackIcon`, and the existing field-error helper where they fit. Preserve functional native tables and operational cards when their layout already suits the task.
- Keep the established surface, text, border, action, spacing, and typography tokens. Inspect import order in `src/main.ts` and existing scoped styles before adding CSS. Prefer changing the owning rule to appending another high-specificity override. Global changes need checks in every affected role.
- Keep route, sailing date/time, vessel, payment state, ticket state, and next action legible. Distinguish payment received, awaiting staff verification, ticket issued, checked in, boarded, and refunded. Use readable labels from `statusPresentation.ts`; avoid deriving business decisions from labels or badge colors.
- Use Philippine time through the existing date helpers for sailing display/input/export. Preserve raw timestamps and amounts for sorting and calculations.
- Distinguish initial loading, refresh with existing records, failed load, empty data, and no filter matches. Offer the appropriate retry, clear-filter, or setup action. Do not present a failed request as a successful zero-result search.
- For form errors, name the failing field, link its message with `aria-describedby`, set `aria-invalid`, and focus the first visible invalid control. Preserve entered data through recoverable errors and prerequisite setup navigation.
- For mobile, prioritize identity, route/time, status, and action; put secondary fields behind accessible disclosure when useful. Keep sticky actions above safe areas and clear of inputs and the software keyboard. Preserve the same action eligibility as desktop.
- Check semantic headings, accessible names, visible focus, keyboard operation and return focus from dialogs. Evaluate essential text at enlarged text/zoom rather than judging readability only from a desktop screenshot.

## Preserve domain behavior

Keep role/port access gates, confirmation dialogs, booking expiry, eligibility checks, monetary calculations, and Supabase authorization intact. A visual change must not expose payment or attendance actions to an ineligible record. Keep ticket QR backgrounds white and existing print/export paths usable. Do not change hosted data or generate real payments/notifications just to preview UI.

## Verify and report

Use focused existing unit tests when behavior changes and browser fixtures for rendered layout, actual AG Grid behavior, dialogs, and responsive changes. Review existing `scripts/verify-*.mjs` before running them: confirm their expected route, fixtures, target URL, and side effects. A stale fixture/assertion is not evidence of a product defect.

For shared UI, inspect representative Admin, Passenger, Ticketing, and Boarding screens in light and dark themes at desktop and mobile widths. Include 768px and the 699/700px boundary for grid changes; include narrow screens, long names/codes, empty/error/loading states, and more than one server page where relevant. Inspect at least representative screenshots; automated overflow checks alone do not establish visual quality. Verify interactive grid controls using the actual grid, because parent unit tests use `tests/support/recordsGridStub.ts`.

Run `npm run lint` and `npm run build` when changing application code. Use unit tests that cover affected behavior; document pre-existing failures accurately. Documentation-only changes need skill validation and reference/link checks, not a full application build.

For a review, give each finding a source location, affected role, concrete trigger/impact, proposed change, priority, and acceptance check. Distinguish source-confirmed behavior, browser observations, and design suggestions. State fixture gaps and untested hardware explicitly. For implementation, report changes, meaningful verification, and remaining limits. Reply in the user's language.
