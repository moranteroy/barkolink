# Android chatbot and ticket fixes — November 5, 2026

The passenger assistant displays clock times as AM/PM, including older chatbot replies rendered by the new app. The deployed chatbot also normalizes new replies, so existing installations receive readable new answers. Philippine timezone offsets, source timestamps, ticket identifiers and link destinations remain unchanged.

The mobile ticket actions use equal-height buttons, with an icon above each label. Print/PDF no longer wraps into a taller button. Layout checks cover 320, 360, 390, 430 and 560 CSS pixels, including enlarged action text.

Print/PDF generates the isolated, white ticket document with an embedded QR. Android opens its native print / Save as PDF sheet through the registered `TicketPrint` Capacitor plugin; web opens the same document in a print window. Ticket eligibility and historical-ticket QR rules still apply before exporting.

Validation: lint and production web build passed; 20 focused assistant/ticket unit tests and 13 chatbot function tests passed. Browser checks passed at all five widths and decoded the actual QR in both the screen and print document. A live passenger chatbot question returned 9:00 PM and 11:00 PM.

Android version is now 1.0.1 (version code 2). UI and native printing changes require building and installing the new APK. Physical-device printing and installation must be verified separately; browser checks and mocked native-plugin tests do not establish device acceptance.
