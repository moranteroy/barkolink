# Maritime UI — October 24, 2026

## Reference refinement

After comparing the actual app with the supplied guide, the header now uses an integrated sea/sky/ferry image with soft edge masks instead of the isolated ferry and drawn wave lines. Current runtime artwork is `public/images/ferry-seascape-v2.webp` (1440 × 480, 37,624 bytes), generated with the built-in image tool and exported to WebP. The first ferry asset is retained as an earlier variant.

Dark backgrounds are deeper navy (`#04162a`), panel surfaces use a restrained blue gradient, inset controls use `#061a2f`, and borders use `#22496d`. Blue gradient section icons, a larger sidebar wordmark, restored section eyebrow, responsive title sizes and bordered live-preview rows follow the guide. Existing discount cards, form validation, vessel drafts and saves are preserved.

The refinement passed the same 32 role/theme/viewport combinations, all 28 fare tests and both-theme actual AG Grid checks. Final header screenshots were reviewed at desktop/tablet widths, and narrow-screen layouts retain readable text with subdued decoration. Project lint still has only the two previously recorded unrelated findings.

Exact built-in generation prompt for the current artwork:

> Create a wide panoramic decorative background image for the header of a premium navy blue ferry booking admin dashboard. Not a UI mockup. No text, letters, interface, buttons, logos or borders. Image composition: the LEFT TWO THIRDS is nearly empty, very dark deep navy #04172e misty night sky and low ocean horizon, suitable for overlaying white heading text. In the RIGHT THIRD, a small modern Philippine inter-island passenger ferry viewed three-quarter from the bow, bow pointing slightly left toward viewer, dark navy hull, cool blue-white decks, small warm amber windows, realistic elegant silhouette. The ferry occupies ONLY about 24 percent of the full canvas width and 32 percent of its height, sitting close to bottom edge on a real dark blue ocean with subtle layered waves. Entire vessel including mast fits inside canvas with ample sky above. Atmospheric soft blue glow in sky behind ferry, sea haze, natural blue water ripples and restrained warm reflections. Deep cinematic blue monochromatic grading, understated moody navy, no purple or teal cast. Low contrast background with tasteful cyan illumination, realistic premium travel product art. Wide horizontal 3:1 composition. Very important: boat should feel naturally embedded in misty seascape, not isolated or pasted on, avoid bright cutout edge. Left edge fades naturally into almost solid #04172e; all four corners are dark navy. The result will be used as a shallow header background beside a refresh button, so keep visual detail low and the small ferry close to bottom right.

## Initial implementation

The shared theme now uses deep navy backgrounds, blue primary actions, cyan accents, green activation states and subtle blue panel borders. Light mode keeps white surfaces and a darker blue action color for readable contrast. Sidebar navigation uses the same navy gradient, blue selection and decorative waves across workspaces.

Admin page headings include a decorative ferry beside Refresh. `MaritimeHeaderArt.vue` hides its artwork from assistive technology and pointer input, reserves room for text at desktop/tablet widths, and reduces the artwork's prominence on narrow screens. Existing passenger discount cards retain their editable fields, activation switches, actions, validation and explicit save behavior, with smaller padding/gaps and a shared bottom row on mobile. Action targets remain 44px.

## Assets

- Runtime ferry: `public/images/ferry-header.webp` (1086 × 362, transparent, 116,090 bytes). Exported from the generated PNG as WebP to reduce transfer size by about 93%.
- Sidebar waves: `public/images/nav-waves.svg`, authored as a small vector graphic.
- Ferry generated with the built-in image generation tool; original retained outside the repo in the tool's generated-images directory. No external image service or API key was used.

Exact generation prompt:

> Create a polished realistic digital illustration asset for a Philippine ferry booking dashboard header. A modern medium-sized inter-island passenger roll-on roll-off ferry, three-quarter side view pointing left, navy blue hull, white upper decks tinted cool blue, small warm amber cabin windows and subtle cyan edge lighting. Clean accurate marine silhouette with bridge, mast, decks, railings. Entire ferry fully visible, centered, generous transparent margins, wide horizontal composition about 3:1. Subtle short blue sea ripples directly underneath the hull only, softly fade to true transparent edges. Evening maritime mood designed to sit on a deep navy #061b32 UI banner, refined and understated like premium travel website header artwork. No letters, no text, no logos, no border, no opaque sky or rectangle backdrop. Asset only, not a UI screenshot.

## Verification

- 28 existing fare tests pass, including draft editing and saving.
- Production build, type checking and postbuild security header verification pass.
- Changed Vue files pass ESLint. Project lint still reports two existing `no-control-regex` findings in `src/data/securityValidation.ts`.
- Isolated browser fixtures checked Admin, Passenger, Ticketing and Boarding in both themes at 1440, 768, 390 and 320px, with no main-content horizontal overflow. Admin fare checks cover image decoding, compact card height, pencil focus, long names, keyboard toggling and add/delete. Final desktop/tablet header screenshots were reviewed after adjusting text clearance.
- Existing actual AG Grid browser checks pass in both themes: typed filters, Philippine dates, responsive state preservation, mobile actions/sort/columns/reset and data replacement.
- Representative screenshots were visually reviewed, including dark desktop fares, light tablet fares, compact dark mobile discounts, Passenger Home and Ticketing dashboard. Artworks and layout checks use fixture data and perform no hosted writes.
- Local screenshots: `.audit/maritime/` and `.audit/discount-cards/`; grid screenshots: `.audit/records-grid-ui/`.
