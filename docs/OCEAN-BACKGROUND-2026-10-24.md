# Shared ocean background — October 24, 2026

The supplied ocean reference now informs the shared background of Passenger, Admin, Ticketing, Boarding, settings, public landing and authentication pages. Port Display always uses the darker ocean treatment. Existing ferry header accents are retained.

The landing hero and final call-to-action show the artwork prominently. Workspaces use a dark navy overlay; light mode uses a pale blue/white overlay on the same composition. Cards, controls, tables and QR surfaces retain their established solid backgrounds. Backgrounds are static and add no animations or account preference changes.

The shared tokens are in `src/theme/variables.css`; the landing treatment is in `src/theme/landing.css`. Workspace containers fill at least one viewport. Passenger information explicitly uses the shared background, while its form cards keep their opaque surfaces. Authentication keeps the form readable beside a navy ocean illustration.

## Asset

- Runtime: `public/images/ocean-background-v1.webp`, 1600 × 900, 22,308 bytes.
- Generated using the built-in image generation tool with the supplied image as a reference. Exported as WebP; the generated original remains in the tool's generated-images directory. The project uses only the optimized workspace asset.
- Light mode derives its pale variant with a CSS overlay, so both modes reuse a single download.

Exact generation prompt:

> Create a premium maritime background texture matching the attached navy ocean reference. This is a background asset only, no UI, no text, no boats, no logos or objects. Wide 16:9 canvas. Very deep navy blue #03172f base. A restrained cinematic blue glow in upper right. Thin realistic dark blue ocean ripples form a narrow horizontal band near the top fifth of the canvas, fading softly toward the left. In the lower left corner, a few delicate flowing cyan-blue wave lines sweep toward the lower center, subtle and elegant. Most of the middle and lower right must be calm almost solid dark navy negative space for dashboard content. Moody blue monochromatic palette, no teal/purple, no bright white highlights. Keep edge details subtle enough for a ferry booking system, modern and premium, faithfully matching the composition and understated feel of the supplied reference.

## Verification

- Role fixtures passed at 1440, 768, 390 and 320px in both themes: 104 views across all four roles, including settings, actual background resolution, asset availability and horizontal-overflow checks.
- Existing landing browser workflows passed in both themes at 1440, 1024, 768, 390 and 320px: navigation, menu focus, route selection, booking search, empty results and recoverable errors.
- Actual AG Grid checks passed in both themes; typed filters, Philippine dates, responsive state, mobile actions and data changes remain functional.
- Port Display checks passed with the quieter backdrop: TV/mobile fitting, five status contrast checks, page rotation, refresh, port selection, stale recovery and kiosk/fullscreen controls.
- Production build, TypeScript and postbuild security-header verification passed. Full lint retains two pre-existing `no-control-regex` findings in `src/data/securityValidation.ts`.
- Representative dark landing, light mobile landing, dark/light Admin, dark mobile Passenger, staff settings and authentication screenshots were visually reviewed. All network-backed previews use isolated fixtures.

Local screenshots: `.audit/ocean-theme/`, `.audit/ocean-landing/`, `.audit/ocean-auth/` and `.audit/port-display/`.
