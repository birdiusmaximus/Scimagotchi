# Scimagotchi → TestFlight (EAS Build)

The chosen path: Scimagotchi is an Expo app, so EAS builds a **real native iOS app in the cloud**
and uploads it to TestFlight. **No local Xcode archiving, no CocoaPods** — which is why this
suits this Mac (no Homebrew / a too-old system Ruby). The native keyboard handling is wired
(`_layout.tsx` listens to React Native's `Keyboard` events → conversation-mode collapse + input
lift), so the keyboard behaves on a real device the way it does in the design.

> The Capacitor wrap (`capacitor.config.ts`, `CAPACITOR*.md`) stays in the repo as an alternative
> WebView path, but it is **not** used here — EAS ships native. The `@capacitor/*` packages ship
> iOS podspecs, so `react-native.config.js` excludes them from autolinking — otherwise their
> `Capacitor`/`CapacitorCordova` pods get pulled into the native Podfile and break `pod install`
> on EAS. With them excluded the bridge no-ops off-web, so the native build is unaffected.

## What's already configured
- `app.json`: `ios.bundleIdentifier` + `android.package` = `health.gig.scimagotchi`, build/version numbers.
- `eas.json`: `development` / `preview` / `production` (auto-incrementing) build profiles + a `submit` profile.
- Native keyboard listener + the conversation-mode layout.

## Prerequisites
- **Expo account** (free) — sign up at expo.dev if you don't have one.
- **Apple Developer Program** ✓ (the same one as Landright).
- Node + this repo. No Xcode/CocoaPods needed locally.

## 1. Log in + build (cloud)
```sh
npx eas-cli@latest login                         # your Expo account
npx eas-cli@latest build --platform ios --profile production
```
On the first build EAS will:
- offer to **create/link an EAS project** → yes (it writes `extra.eas.projectId` into `app.json`),
- ask about **iOS credentials** → choose "let EAS handle it" and sign in to your Apple Developer
  account; EAS registers the bundle id `health.gig.scimagotchi`, creates the distribution cert +
  provisioning profile, and stores them. (If you'd rather use your own namespace, change
  `bundleIdentifier`/`package` in `app.json` first.)

The build runs on EAS's macOS workers (~10–20 min). You get a link to the finished `.ipa`.

## 2. Create the App Store Connect record (one-time)
EAS Submit does **not** auto-create it. In **App Store Connect → Apps → + → New App**:
- Platform iOS · Name **Scimagotchi** · Bundle ID `health.gig.scimagotchi` · pick an SKU.

## 3. Submit to TestFlight
```sh
npx eas-cli@latest submit --platform ios --latest
```
It uploads the latest build to App Store Connect. When prompted, the easiest credential is an
**App Store Connect API key** (EAS can create one), or your Apple ID + an app-specific password.

> Shortcut for next time: `eas build --platform ios --profile production --auto-submit` builds
> and submits in one step.

After upload, the build **processes** in App Store Connect for a few minutes, then shows under
**TestFlight**.

## 4. Test on a real iPhone
- **TestFlight tab → Internal Testing**: add yourself (and teammates) — no review needed; install
  via the TestFlight app immediately. **External testing** needs a short Beta App Review.
- On the device, walk the checklist:
  - [ ] No white bar / the gradient runs under the status bar; opening the keyboard doesn't jump or
        squish, and the companion stays visible (collapses to the header avatar).
  - [ ] Set your **OpenAI key in Settings** and confirm one real companion turn works (the live AI
        uses that key; the dev `ai-proxy` is not used in the app).
  - [ ] Check-ins / memory / weekly summary persist — `expo-sqlite` is real native SQLite here.

## 5. Iterating
After any change: `npx eas-cli@latest build -p ios --profile production --auto-submit`. The
`autoIncrement` profile bumps the build number each time (TestFlight needs a unique build per
version). Android is the same with `-p android` once you set up a Play Console track.

## Notes
- The voice-input mic is hidden on iOS (no native speech module wired — `useSpeechRecognition`
  reports unsupported), so no microphone permission is requested. Add `expo-speech-recognition`
  + a config plugin later if you want native dictation.
- Free-tier EAS Build has a monthly build quota and a shared queue; paid tiers build faster.
