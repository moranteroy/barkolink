# Shared UI and appearance

BarkoLink keeps Ionic for routing, page containers, native overlays, and mobile navigation. AG Grid Community remains the desktop/tablet records grid. Source-owned shadcn-vue components live in `src/components/ui`, using Reka UI primitives, class-variance-authority, and the `cn` utility. They are adapted to BarkoLink's existing theme tokens instead of introducing a separate palette. `components.json` configures future shadcn-vue additions. Icons use the maintained `@lucide/vue` package.

Tailwind 4 runs through its Vite plugin. Only its theme and utilities are imported: Preflight is deliberately omitted so Ionic's reset and existing forms keep their behavior. Shared component styles are in `src/theme/ui.css`.

- Desktop records: column visibility menu, loaded-page record counts, alternating rows, fit/reset controls, and semantic status badges. The column menu keeps at least one data column visible. Reset restores hidden columns. Search and pagination remain backend-driven; grid sorting/filtering affects the loaded page.
- Mobile records: readable cards, existing authorized row actions, and skeleton loading cards.
- Passenger web: a centered canvas up to 560px with the same compact layouts as mobile, bottom navigation, safe-area spacing, and touch-sized controls. Profile, travelers, ferry search, settings, tickets, and the booking flow use the shared passenger container.
- Ferry search: source-owned buttons, status badges, keyboard-accessible departure-time toggles, and skeleton loading cards.
- Appearance: keyboard-accessible Light/Dark/System selection, preview cards, and the resolved theme. The Ionic dark class, shadcn dark class, document color scheme, and AG Grid CSS tokens update together. The preference persists locally, follows live OS changes in System mode, synchronizes across tabs, and resolves before first paint. QR images and printable tickets retain a white background.

Verification: `npm run lint`, `npm run test:unit`, `npm run build`, and `node scripts/verify-experience-ui.mjs`. Browser checks intercept all Supabase traffic with isolated fixtures, cover desktop/tablet/phone layouts, column hide/reset, appearance persistence, live system preference changes, and the existing booking/account/ticket workflows. Optional `BARKOLINK_UI_WIDTHS`, `BARKOLINK_UI_ROLE`, and `BARKOLINK_UI_PATHS` narrow browser checks.

References: [shadcn-vue Vite setup](https://www.shadcn-vue.com/docs/installation/vite), [shadcn-vue theming](https://www.shadcn-vue.com/docs/theming), [AG Grid theming](https://www.ag-grid.com/vue-data-grid/theming-colors/).
