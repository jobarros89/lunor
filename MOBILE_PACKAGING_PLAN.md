# LUNOR Mobile Packaging

This work packages the existing LUNOR web application for native mobile distribution while keeping the current Next.js application and Supabase backend as the source of truth.

## Scope

- Keep the current Next.js web app as the source of truth.
- Keep `https://lunorservice.com` and the browser/PWA shortcut working throughout the native migration.
- Reuse the same Supabase backend and application data.
- Do not redesign or convert the existing web application just to satisfy mobile packaging.
- Prepare iOS first for TestFlight/App Store, then reuse the approach for Android where appropriate.

## Current state

- Capacitor 8 is installed.
- Bundle/Application ID: `com.lunor.app`.
- Android native project already exists in the repository.
- iOS is generated in CI instead of being committed.
- The first unsigned iOS Simulator compile proof passed in Codemagic.
- The Capacitor configuration now supports two explicit profiles:
  - `remote`: compatibility/internal mode that keeps the current `https://lunorservice.com` WebView behavior.
  - `local`: omits `server.url` and starts from packaged assets in `out/`.
- `remote` remains the default during the transition so existing native tests are not broken.
- The web/PWA deployment is independent from these profiles and is not changed by the mobile packaging work.

## Why two profiles

Capacitor documents `server.url` as intended for live-reload and not production. Removing it abruptly would leave the current server-rendered Next.js product without its UI inside the native package.

The migration is therefore incremental:

1. preserve the current remote wrapper for internal validation;
2. prove that the native package boots from local assets without `server.url`;
3. move the mobile entry experience and native integrations into the local shell;
4. only create the signed TestFlight/App Store workflow when the local experience is useful enough for real users.

The local shell is intentionally a foundation, not the final product UI. It does not replace the Next.js web application.

## Brand

Use the approved LUNOR app icon:
- black background
- white crescent
- violet / magenta / orange / yellow rays
- no extra mystical/geometric decoration in the app icon

The same identity should be used for:
- iOS app icon
- Android app icon
- favicon
- apple-touch-icon
- PWA manifest icons
- Capacitor/native splash assets

## iOS execution plan

### Milestone 0 — compile proof ✅

1. Generate the iOS project with Capacitor on a cloud macOS runner.
2. Sync Capacitor and generate the LUNOR icon set.
3. Compile an unsigned iOS Simulator build.
4. Validate the Codemagic pipeline.

Result: completed successfully.

### Milestone 1A — local shell foundation

1. Keep remote compatibility mode available for internal tests.
2. Generate a packaged LUNOR shell in `out/`.
3. Compile iOS with `CAPACITOR_APP_MODE=local`.
4. Assert that the generated iOS config does not contain `lunorservice.com` or a remote `server.url`.
5. Confirm that the web/PWA continues to operate independently.

Codemagic workflow: `ios-local-shell-compile` — **LUNOR iOS - local shell proof**.

### Milestone 1B — useful native/mobile experience

Before a signed build:

1. Define the minimum local mobile experience for login/session and the user's next service.
2. Add deep-link routing so invitations and notifications open the correct service/preparation screen.
3. Add push notifications using the existing LUNOR backend as the source of truth.
4. Validate keyboard, safe areas, external links and session persistence.
5. Keep every web feature available at `lunorservice.com` while native capabilities are added.
6. Add the iOS privacy manifest/permission declarations required by the native features actually used.

### Milestone 2 — signed TestFlight build

1. Use an active Apple Developer Program account.
2. Create the `com.lunor.app` identifier in Apple Developer/App Store Connect.
3. Configure App Store Connect API credentials and automatic signing in Codemagic.
4. Generate a signed `.ipa` from the local production profile.
5. Upload the first build to TestFlight.

### Milestone 3 — App Store submission

1. Finish privacy policy/App Privacy answers.
2. Prepare screenshots, description, category and support information.
3. Run final QA using production accounts and realistic Louvor/Kids flows.
4. Submit for App Review.
