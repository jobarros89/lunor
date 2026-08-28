# LUNOR Mobile Packaging

This branch packages the existing LUNOR web application as a native mobile shell using Capacitor.

## Scope

- Keep the current Next.js web app as the source of truth.
- Add native wrappers for iOS and Android.
- Reuse the same Supabase backend and application flows.
- Do not redesign web behavior unless required for mobile compatibility.

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

## First milestone

1. Add Capacitor configuration.
2. Add mobile/PWA metadata and icon references.
3. Add native iOS and Android projects.
4. Verify navigation, safe areas, keyboard, external links and auth callbacks.
5. Produce the first installable cloud build.
