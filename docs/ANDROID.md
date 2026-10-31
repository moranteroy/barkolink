# BarkoLink Android build and device testing

The Android project is in `android/`, with application ID `com.barkolink.app`, camera permission for ticket scanning, and the current web assets synchronized. It uses the same Supabase project as the web app.

## Current machine limitation

Local APK compilation requires a valid JDK and Android SDK. On this machine the previously configured JDK directory was missing, and no Android SDK was detected. GitHub Actions provides a separate Linux build environment, so it can build the APK without installing Android Studio on this computer. Real-device acceptance still needs to be recorded separately.

Install Android Studio 2025.2.1 or newer and Android SDK Platform 36, Build Tools and Platform Tools. Android Studio includes a compatible JDK. Point `JAVA_HOME` to the actual JDK folder containing `bin/java.exe`, and `ANDROID_HOME` to the SDK folder. See [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup).

## GitHub Actions APK

The repository workflow `.github/workflows/build-apk.yml` runs on pushes to `main` and from **Actions > Build BarkoLink Android APK > Run workflow**. It uses Node 24, Java 21, Android SDK 36 and the checked-in Capacitor Android project.

Under **Settings > Secrets and variables > Actions**, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as repository variables or secrets. Secrets take precedence. A legacy `VITE_SUPABASE_ANON_KEY` is accepted as an alternative. These are browser-public credentials; never use a service-role key, Supabase management token or database password. The workflow validates this before building. No Firebase configuration or external API server is required.

After a successful run, download **BarkoLink-Android-APK** from the run's Artifacts section and extract `BarkoLink-debug.apk`. This debug-signed package is suitable for installation and presentation testing. Store distribution requires a separately configured release signing key.

The app uses the single client in `src/services/supabase.ts`, with persistent sessions and automatic token refresh enabled. There is no `firebase.ts` or duplicate authentication client. Android launcher icons use the BarkoLink ferry mark, including the adaptive foreground vector.

## Local build

From the BarkoLink project directory:

```powershell
npm run android:build
```

This validates the toolchain, builds the web app, syncs Capacitor, and runs Gradle `assembleDebug`. The expected artifact is `android/app/build/outputs/apk/debug/app-debug.apk`. Alternatively, open `android/` in Android Studio and build/run from there.

Keep the configured public Supabase URL/key in `.env.local` before building. Never add a service-role key to the mobile app. Production email confirmation/reset links still need the actual hosted origin and redirect configuration; local development redirects do not establish a production mobile deep-link flow.

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
- Turn off Internet: show an actionable connection error and do not report a successful payment or boarding action.

Record phone model, Android version, APK build date and each test outcome. Windows cannot locally build/test iOS; a macOS/Xcode environment is required for that target.
