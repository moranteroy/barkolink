# PDF report branding — October 25, 2026

The shared `src/data/reportPdf.ts` exporter now uses the existing BarkoLink ship mark, navy header, blue wordmark and teal accent. `public/images/brand/barkolink-mark.png` is a transparent 384 px rendering of the existing SVG, for jsPDF image support.

Reports show the title and selected scope separately, with summary metrics in three columns. Tables use a navy heading, alternating pale rows, more cell spacing and right-aligned PHP amounts. Passenger manifests use the same branding without summary cards. Each page repeats its logo, title, scope and column headers, with a note and page count in the footer. Header and footer spacing follows wrapped text. Embedded Noto Sans fonts preserve passenger names. Data selection, monetary values, staff permissions and export filenames are unchanged.

## Verification

- Seven focused PDF/manifest unit tests passed (`reportPdf.spec.ts`, `adminManifestExport.spec.ts`), including the existing 501-passenger manifest export test.
- Generated actual fixture PDFs for a six-metric operations report (40 rows, 5 pages), a passenger manifest (501 rows, 39 pages), and an empty report (1 page).
- Parsed all generated pages: each has the logo, one report heading, and correct page numbering. Verified every manifest passenger/booking and every operations sailing appears exactly once, with no text outside the page bounds. Summary values appear once.
- Rendered and visually reviewed report and manifest pages. Generated artifacts are local ignored files under `.audit/styled-*`.
- Full lint still reports the two existing `no-control-regex` errors in `src/data/securityValidation.ts`; the modified PDF files pass focused lint.
- Production build and the post-build security header check passed.

Staff login credentials are kept separately in the ignored local `.audit` directory and must not be included in source control.
