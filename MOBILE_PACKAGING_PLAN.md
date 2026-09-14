# LUNOR Mobile Packaging

This work packages the existing LUNOR web application for native mobile distribution while keeping the current Next.js application and Supabase backend as the source of truth.

## Scope

- Keep the current Next.js web app as the source of truth.
- Reuse the same Supabase backend and application flows.
- Do not redesign web behavior unless required for mobile compatibility.
- Prepare iOS first for TestFlight/App Store, then reuse the approach for Android where appropriate.

## Current state

- Capacitor 8 is already installed.
- Bundle/Application ID: `com.lunor.app`.
- Android native project already exists in the repository.
- iOS native project is not committed yet.
- `capacitor.config.ts` currently points `server.url` to `https://lunorservice.com`.

> Important: Capacitor documents `server.url` as a live-reload option and not intended for production. We can use the current setup only to prove native compilation while the production mobile delivery strategy is finalized.

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

### Milestone 0 — compile proof

1. Generate the iOS project with Capacitor on a cloud macOS runner.
2. Sync Capacitor and generate the LUNOR icon set.
3. Compile an unsigned iOS Simulator build.
4. Fix native/runtime compatibility problems before introducing Apple signing.

The `codemagic.yaml` workflow `ios-capacitor-compile` implements this proof without requiring Apple credentials.

### Milestone 1 — App Store-ready shell

1. Remove production dependency on Capacitor `server.url`.
2. Define the production mobile shell/assets strategy without breaking the Cloudflare/OpenNext web deployment.
3. Validate authentication callbacks, keyboard, safe areas, external links and session persistence.
4. Add meaningful native capabilities such as notifications and deep links.
5. Add iOS privacy manifest/permission declarations required by the native features we actually use.

### Milestone 2 — signed TestFlight build

1. Enroll/use an active Apple Developer Program account.
2. Create the `com.lunor.app` identifier in Apple Developer/App Store Connect.
3. Configure App Store Connect API credentials and automatic signing in Codemagic.
4. Generate a signed `.ipa`.
5. Upload the first build to TestFlight.

### Milestone 3 — App Store submission

1. Finish privacy policy/App Privacy answers.
2. Prepare screenshots, description, category and support information.
3. Run final QA using production accounts and realistic Louvor/Kids flows.
4. Submit for App Review.
