# Capacitor native shell

Rowly ships primarily as a PWA. The Capacitor wrapper is how we get into
Apple's App Store and Google Play, and — more importantly — how we gain
access to native surfaces the web can't reach: **home-screen widgets**,
push notifications with priority, and richer background work.

This document covers setup. For widget implementation details see
`docs/WIDGETS.md` (once the iOS/Android projects exist).

## Status

- ✅ Capacitor packages installed (`@capacitor/core`, `@capacitor/cli`,
  `@capacitor/ios`, `@capacitor/android`)
- ✅ `frontend/capacitor.config.ts` configured (`appId: com.rowlyknit.app`,
  `appName: Rowly`, `webDir: dist`)
- ⏳ `frontend/ios/` project — run `npm run cap:add:ios` to generate
- ⏳ `frontend/android/` project — run `npm run cap:add:android` to generate
- ⏳ iOS home-screen widget extension — next PR after native projects exist
- ⏳ Android home-screen widget (Glance) — next PR after native projects exist

## Prerequisites on your Mac

Before running `cap add`, install:

| Tool | Why | Install |
|---|---|---|
| Xcode (full app) | Builds iOS app + widget extensions | Mac App Store |
| CocoaPods | Dependency manager `cap add ios` runs | `sudo gem install cocoapods` or `brew install cocoapods` |
| Android Studio | Builds Android app + widgets | https://developer.android.com/studio |
| JDK 17 | Android Gradle build | `brew install openjdk@17` |

Xcode Command Line Tools alone is **not enough** — `pod install` needs the
full IDE to resolve platform frameworks.

## First-time setup

From `frontend/`:

```bash
# 1. Build the web bundle so Capacitor has something to copy.
npm run build

# 2. Generate the iOS project. This creates frontend/ios/App.xcworkspace.
#    CocoaPods will install ~100 MB of pods the first time.
npm run cap:add:ios

# 3. Generate the Android project.
npm run cap:add:android

# 4. Commit both new directories. They're part of the source tree.
git add ios android
git commit -m "chore(cap): generate iOS + Android projects"
```

After the first setup, your day-to-day is:

```bash
# After any web-side change, re-bundle and push to the native projects.
npm run cap:sync

# Open Xcode / Android Studio when you need to change native code or run on a device.
npm run cap:open:ios
npm run cap:open:android
```

## Signing + distribution

Neither CI nor the droplet builds the native apps — Capacitor apps are
built from Xcode / Android Studio on your Mac and uploaded to:

- **iOS**: Apple Developer account ($99/yr) → App Store Connect → TestFlight
  for beta, App Store for public. Widget extensions ship inside the app
  bundle — no separate review.
- **Android**: Google Play Console ($25 one-time) → internal testing track
  → production. APK / AAB can also be sideloaded for personal testing.

## Home-screen widget roadmap

The Capacitor wrapper is **step 1 of 3** for home-screen widgets:

1. **Native wrapper** (this PR) — lets the web app run inside an iOS /
   Android shell. No widgets yet.
2. **Shared storage + plugin** — a custom Capacitor plugin exposes the
   active stitch counter to the widget extension via iOS App Groups
   (shared `UserDefaults`) and Android `ContentProvider`.
3. **Widget extensions** — Swift + WidgetKit for iOS, Kotlin + Glance for
   Android. Each reads from the shared storage and refreshes on timeline
   updates.

Steps 2 and 3 require the native projects to exist, hence running `cap add`
first.
