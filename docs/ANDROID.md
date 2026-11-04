# BarkoLink Android build and device testing

The Android project is in `android/`, with application ID `com.barkolink.app`, camera permission for ticket scanning, and the current web assets synchronized. It uses the same Supabase project as the web app.

## Current machine limitation

Local APK compilation requires a valid JDK and Android SDK. On this machine the previously configured JDK directory was missing, and no Android SDK was detected. GitHub Actions provides a separate Linux build environment, so it can build the APK without installing Android Studio on this computer. Real-device acceptance still needs to be recorded separately.

Install Android Studio 2025.2.1 or newer and Android SDK Platform 36, Build Tools and Platform Tools. Android Studio includes a compatible JDK. Point `JAVA_HOME` to the actual JDK folder containing `bin/java.exe`, and `ANDROID_HOME` to the SDK folder. See [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup).

## GitHub Actions APK

The repository workflow `.github/workflows/build-apk.yml` runs on pushes to `main` and from **Actions > Build BarkoLink Android APK > Run workflow**. It uses Node 24, Java 21, Android SDK 36 and the checked-in Capacitor Android project.

Under **Settings > Secrets and variables > Actions**, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as repository variables or secrets. Secrets take precedence. A legacy `VITE_SUPABASE_ANON_KEY` is accepted as an alternative. These are browser-public credentials; never use a service-role key, Supabase management token or database password. The workflow validates this before building. No Firebase configuration or external API server is required.

After a successful run, download **BarkoLink-Android-APK** from the run's Artifacts section and extract `BarkoLink.apk`. This debug-signed package is suitable for installation and presentation testing. Store distribution requires a separately configured release signing key.

The app uses the single client in `src/services/supabase.ts`, with persistent sessions and automatic token refresh enabled. There is no `firebase.ts` or duplicate authentication client. Android launcher icons use the BarkoLink ferry mark, including the adaptive foreground vector.

## Local build

From the BarkoLink project directory:

```powershell
npm run android:build
```

This validates the toolchain, builds the web app, syncs Capacitor, and runs Gradle `assembleDebug`. The expected artifact is `android/app/build/outputs/apk/debug/app-debug.apk`. Alternatively, open `android/` in Android Studio and build/run from there.

Keep the configured public Supabase URL/key in `.env.local` before building. Never add a service-role key to the mobile app.

## Email confirmation and password recovery

In the Supabase project's **Authentication > URL Configuration > Redirect URLs**, allow these exact native destinations in addition to the actual hosted web destinations:

```text
com.barkolink.app://auth/login
com.barkolink.app://auth/reset-password
```

Native signup/resend and password reset now request those destinations. Android handles the app scheme, and the app consumes both running-app and cold-start links. Native requests use PKCE: the code must be exchanged with the verifier stored by this installation. Bearer-token fragments and unrelated hosts/routes are rejected. An active account is not replaced by a new email-link session; log out first, or use the manual email-code flow. Browser auth keeps its normal web redirects.

Apply the redirect allowlist to the actual project and rebuild/sync the APK. Test real confirmation and recovery emails on a physical device, with the app open, backgrounded, and closed. Links requested on another installation may lack the matching PKCE verifier; the manual email code remains the fallback. Do not put verification URLs, codes, or tokens in logs or screenshots.

## Mobile layout and system bars

The APK starts in immersive mode: status/navigation bars are hidden and an edge swipe temporarily reveals them, following [Android's immersive-mode behavior](https://developer.android.com/develop/ui/views/layout/immersive). `MainActivity` reapplies this when the app resumes or regains focus. Capacitor SystemBars supplies display-cutout insets; the app reserves top clearance once. The passenger bottom navigation hides while the software keyboard is open.

Phone density rules apply at or below 600 CSS pixels. Desktop/laptop layouts retain their existing styling. See [the mobile follow-up and verification](MOBILE-UI-2026-11-04.md). Build and install a new APK to receive these changes; synchronizing source assets alone does not update an installed app. Mobile browser system bars remain controlled by the browser/OS.

## Device acceptance checklist

Use an Android phone or emulator with Internet access. For camera testing, use a physical device and a printed/displayed ticket from a different screen.

- Log in with passenger, ticketing and boarding accounts; verify role redirects.
- Reserve a trip and confirm the payment deadline matches the web record.
- Verify discounted passengers at ticketing, collect cash and open the ticket.
- Allow camera access and scan the issued ticket; deny access once and confirm manual ticket-code entry works.
- Check in, set the trip to BOARDING in the admin web app, then board the passenger.
- Scan the same ticket again; counts must remain unchanged.
- Observe a cancellation/expiry from another browser within the 15-second refresh interval.
- Test screen rotation, small screens, keyboard input, Android Back navigation, app background/resume and logout.
- Test gesture and three-button navigation: system bars hide on launch/resume, an edge swipe temporarily reveals them, and no content overlaps the display cutout. Check the last card above bottom navigation, input visibility with the keyboard open, and enlarged system text.
- Turn off Internet: show an actionable connection error and do not report a successful payment or boarding action.

Record phone model, Android version, APK build date and each test outcome. Windows cannot locally build/test iOS; a macOS/Xcode environment is required for that target.
