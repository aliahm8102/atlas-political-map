# Atlas Android TWA

This Android application opens `https://atlas-peyma.ir/` through Google's Android Browser Helper, with the same sign-in and browser session as the website. Its application ID is `ir.atlas_peyma.twa`. Android 6.0 (API 23) or newer is required. A compatible installed browser supplies TWA rendering; the library uses a Custom Tab when trusted mode is unavailable. The wrapper does not embed a separate WebView or store account data itself.

`twa-config.json` supplies the application ID, origin, launch path, colors and version to Gradle. Increase `versionCode` and `versionName` before releasing updates. The Android manifest handles HTTPS app links for this exact host and leaves device orientation unrestricted, so the existing map's portrait/landscape handling continues to work.

## Signing and domain verification

The initial release key has been generated locally under `signing/`. This entire directory is ignored by Git. Back up **all** of it in a private, secure location, including `atlas-release.p12` and `signing.properties`. The latter contains the generated password. Losing the key prevents updates to APKs signed with it. Never commit these files or paste their passwords into build logs.

`../public/.well-known/assetlinks.json` contains only the public SHA-256 certificate fingerprint and package name. Deploy the web app before testing trusted mode: `https://atlas-peyma.ir/.well-known/assetlinks.json` must return this JSON with HTTP 200, `Content-Type: application/json`, and no redirects or login. Until it is served and verified by Android/Chrome, the app can show the browser address bar. Signing the Android package alone does not publish the website.

On a fresh checkout, restore `signing/` from backup. `npm run twa:signing` from `atlas/` reuses an existing key and synchronizes its public fingerprint. If no key or signing properties exist it generates a new key, which is appropriate only for a new application identity; do not do this for an already released app. Partial signing directories cause an error instead of replacement. Existing certificate fingerprints are preserved, including any added for Google Play App Signing.

For Google Play distribution, add the **app signing key certificate** SHA-256 from Play Console to the `sha256_cert_fingerprints` array. Play-distributed APKs can use a different signing certificate from the local upload key. Keep the existing local fingerprint if directly installed APKs should also verify. Debug builds use Android's debug key and do not verify against the release fingerprint.

## Build

Install JDK 17 or 21 and Android SDK Platform 36 with Build Tools 35.0.0. Set `JAVA_HOME` and `ANDROID_HOME` (or set `sdk.dir` in the ignored `local.properties`). The checked-in Gradle 8.13 wrapper pins and verifies the distribution checksum. The project pins Android Gradle Plugin 8.13.2 and Android Browser Helper 2.7.3.

From this directory on Windows:

```powershell
.\gradlew.bat :app:assembleRelease :app:bundleRelease
```

On macOS/Linux:

```sh
sh gradlew :app:assembleRelease :app:bundleRelease
```

Outputs are ignored by Git:

- `app/build/outputs/apk/release/app-release.apk`: signed APK for installation.
- `app/build/outputs/bundle/release/app-release.aab`: signed Android App Bundle for Google Play.

Release tasks fail if signing configuration is absent rather than producing an unsigned artifact. You can also open this folder in Android Studio. No website deployment or Play Store upload is performed by the build.

## Verify

Run the web test suite from `atlas/` with `npm test`. With a device connected, install the release APK using `adb install -r app/build/outputs/apk/release/app-release.apk`. After deploying the asset links, run:

```sh
adb shell pm verify-app-links --re-verify ir.atlas_peyma.twa
adb shell pm get-app-links ir.atlas_peyma.twa
```

Open the application and check sign-in, verified-domain browsing without the address bar, deep links to `/workspace`, screen rotation, and the bilingual PWA offline page after an online visit. Third-party origins should show browser UI. Verification needs an Android device or emulator and the deployed domain; Node tests cannot establish it.

References: [Android TWA overview](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities), [Chrome Digital Asset Links guide](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start), [Android Browser Helper](https://github.com/GoogleChrome/android-browser-helper).
