# Reports, PDF export and collection trend

Reports & analytics now downloads actual PDF files for the selected report and passenger manifest. The report includes the selected report type, Philippine departure-date range, route/vessel filters, search text, summary metrics, complete original columns and every matching report row. Summary metrics follow date/route/vessel scope; table rows additionally apply report search, before AG Grid column filters/sorting. The export note states this scope.

Manifest export still uses the secured server operation and fetches all passenger pages in batches of 500. Failed requests do not produce partial downloads. A changed sailing selection invalidates a PDF that is still rendering. Eligibility remains all passengers on paid, confirmed reservations.

PDFs use landscape A4, repeat table/report headers, carry Philippine generation/boarding timestamps and page counts, and embed the bundled OFL Noto Sans fonts for accented names. Route arrows are written as `to` in the PDF to preserve direction without depending on a missing arrow glyph. PDF code loads on demand; fonts are fetched from the app itself. `jspdf` and `jspdf-autotable` provide PDF/table generation. The font license is in `public/fonts/OFL-NotoSans.txt`.

The collection chart fits its container without horizontal scrolling. It has a rounded PHP axis, readable date labels, selectable/focusable points, an explicit zero-collection state, accurate zero baselines, peak/total amounts and accessible collection data. Existing daily/weekly/monthly grouping and departure-date revenue semantics remain unchanged. Expired bookings now also appear in the booking distribution.

Detailed report tables use seven primary columns, grouping route/vessel, sailing/departure and booking/terminal progress. Full export columns remain available in the PDF. This reduces horizontal scrolling while preserving the existing numeric/date filter values and mobile cards.

Verification: focused unit tests cover chart geometry, analytics, actual multipage PDF output, all-page manifest retrieval and stale selection protection. Browser fixtures covered 1366, 768, 699, 700, 390 and 320px in light/dark themes, with an American browser timezone; actual AG Grid headers, chart overflow, keyboard focus, empty daily and monthly charts, search scope and downloaded PDFs were checked. A real PDF parser verified all report rows, a search-filtered PDF, all 501 manifest passengers, accented names, Philippine timestamps and final page numbers. First/last PDF pages and representative desktop/mobile layouts were rendered and inspected. All browser records were synthetic and backend requests intercepted; no hosted records were changed.

All 50 focused unit tests and the production build/CSP checks passed. Full lint retains the two existing `no-control-regex` errors in `src/data/securityValidation.ts`.
