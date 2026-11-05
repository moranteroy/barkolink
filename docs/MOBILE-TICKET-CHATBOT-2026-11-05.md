# Android chatbot and ticket fixes — November 5, 2026

The passenger assistant displays clock times as AM/PM, including older chatbot replies rendered by the new app. The deployed chatbot also normalizes new replies, so existing installations receive readable new answers. Philippine timezone offsets, source timestamps, ticket identifiers and link destinations remain unchanged.

The mobile ticket actions use equal-height buttons, with an icon above each label. Print/PDF no longer wraps into a taller button. Layout checks cover 320, 360, 390, 430 and 560 CSS pixels, including enlarged action text.

Print/PDF generates the isolated, white ticket document with an embedded QR. Android opens its native print / Save as PDF sheet through the registered `TicketPrint` Capacitor plugin; web opens the same document in a print window. Ticket eligibility and historical-ticket QR rules still apply before exporting.

Validation: lint and production web build passed; 20 focused assistant/ticket unit tests and 13 chatbot function tests passed. Browser checks passed at all five widths and decoded the actual QR in both the screen and print document. A live passenger chatbot question returned 9:00 PM and 11:00 PM.

Android version is now 1.0.1 (version code 2). UI and native printing changes require building and installing the new APK. Physical-device printing and installation must be verified separately; browser checks and mocked native-plugin tests do not establish device acceptance.

The [Android APK workflow](https://github.com/moranteroy/barkolink/actions/runs/42023127550) passed for commit `df82123` on the isolated `fix/android-ticket-chatbot-20261105` branch, including native Java compilation, debug APK signing and artifact upload. The original working checkout remains on `main`; no merge was performed. The compiled snapshot also includes the existing presentation fixes needed by the current application.

The screenshot gallery and ZIP were refreshed with the actual Carlo account's ticket and live AM/PM answer, bringing the collection to 94 images. These remain browser captures rather than screenshots from a physical Android phone.

Installer: `../BarkoLink-Mobile-Fixed.apk` (12,148,383 bytes). The downloaded APK contains 362 bundled web files and the compiled `TicketPrintPlugin` class. SHA-256: `20c44be967f7e6fbd4ae6515e59cc1d358bc8fffdece63a78cf5ae4cb6858c37`.

Install this APK on the phone to apply the ticket changes. If Android rejects an update because the old debug APK uses a different signing key, uninstall the old demo APK and install this one, then sign in again. Server bookings remain tied to the account.
