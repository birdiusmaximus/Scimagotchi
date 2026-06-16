# Scimagotchi → iOS → TestFlight

A step-by-step to get the Capacitor wrap onto a real iPhone via TestFlight. You've done this
for Landright, so this is the Scimagotchi-specific version. All of it runs in **your normal
shell + Xcode** (the agent sandbox here has no Homebrew and only macOS system Ruby 2.6, so it
can't run CocoaPods or sign — but everything is configured and ready for you to build).

Already in place: `capacitor.config.ts` (appId, keyboard `resize:'none'`, status-bar overlay,
background colour), the `build:web` → `dist/` pipeline (+ the `viewport-fit=cover` patch), the
runtime keyboard bridge, and the npm scripts below. `/ios` is git-ignored (regenerable).

## 0. Prerequisites (you have these)
- Apple Developer Program membership ✓ (same one as Landright)
- Xcode 26.5 ✓
- **CocoaPods** — `pod --version` should work in your shell. If not: it needs Ruby ≥ 2.7, so
  install via a real Ruby (the macOS system Ruby 2.6 is too old):
  `brew install cocoapods`  (or `sudo gem install cocoapods` if your default Ruby is ≥ 2.7).

## 1. First-time native setup
```sh
npm run build:web          # exports the SPA to dist/ + patches viewport-fit=cover
npx cap add ios            # creates ./ios/App and runs `pod install`
```
If `cap add ios` ever stops at the pod step, just `cd ios/App && pod install && cd ../..`.

## 2. App icon
```sh
npx @capacitor/assets generate --ios --assetPath assets/images
```
(Generates the iOS icon set from `assets/images/icon.png`. Splash optional.)

## 3. Open Xcode and set signing
```sh
npm run cap:ios            # build:web → cap sync → opens ios/App/App.xcworkspace
```
In Xcode, select the **App** target → **Signing & Capabilities**:
- **Team:** your Apple Developer team (same as Landright)
- **Bundle Identifier:** `health.gig.scimagotchi` — change it in `capacitor.config.ts` (then
  re-`cap sync`) if you'd rather match your existing namespace; it must be a registered App ID
  (Xcode's "automatically manage signing" will register it for you)
- **Automatically manage signing:** on
- General → **Display Name:** Scimagotchi · **Version:** 1.0.0 · **Build:** 1

No microphone permission is needed: the voice-input mic uses the Web Speech API, which WKWebView
doesn't support, so it's simply hidden in the wrap. Only add `Info.plist` usage strings if you
later add a native capability.

## 4. Run on a real iPhone first (sanity)
Plug in your iPhone, pick it as the run target, **▶ Run**. Walk the keyboard checklist:
- [ ] No white bar at the top; the gradient runs under the status bar
- [ ] No `‹ › Done` accessory bar above the keyboard
- [ ] Opening the keyboard does NOT jump or squish; the companion stays visible (collapses to the header avatar)
- [ ] Input sits flush above the keyboard
- [ ] The SQLite-backed data (check-ins, memory, progress) loads — `expo-sqlite` runs as WASM in
      the WebView; if it fails to open, that's the first thing to debug on device.

## 5. Archive + upload to TestFlight
1. Set the run destination to **Any iOS Device (arm64)**.
2. **Product → Archive**.
3. In the Organizer: **Distribute App → App Store Connect → Upload**.
4. In **App Store Connect** → create the app record if it doesn't exist (same bundle id), then
   the **TestFlight** tab → the build appears after processing (a few min).
5. **Internal testing** (you + your team): add yourself as a tester — no review needed, installs
   via the TestFlight app immediately. **External testing** needs a short Beta App Review.

## 6. Everyday loop (after any JS/UI change)
```sh
npm run cap:ios            # build:web → cap sync → open Xcode, then Archive → Upload
# or just push the web build into the native project without opening:
npm run cap:sync
```
Bump the **Build** number each upload (TestFlight requires a unique build per version).

## Notes
- Always `npm run build:web` (or `cap:sync`, which does it) before archiving — Capacitor ships
  whatever is in `dist/`, so a stale `dist/` ships stale JS.
- The companion's live AI uses the OpenAI key entered in the app's **Settings** (the `ai-proxy`
  here is dev/eval-only). On the WebView, that key persists via the web storage fallback — after
  install, set the key in Settings and confirm one real turn works on the device.
- Android is the same flow via `npm run cap:android` (needs Android Studio + SDK).
