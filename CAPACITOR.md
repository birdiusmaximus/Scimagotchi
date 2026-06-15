# Capacitor native wrap (iOS + Android)

Scimagotchi ships its Expo **web** build (`dist/`, a single-page app) inside native
iOS/Android WebView shells via [Capacitor](https://capacitorjs.com). This exists for one
reason: to fix the mobile **keyboard layout** (white bar at the top, the view jumping, the
companion getting crushed) — problems that are unfixable in mobile Safari but fully
controllable in a native shell.

## How the keyboard fix works

Three pieces, all already wired into this repo:

1. **The WebView never resizes.** `capacitor.config.ts` sets `Keyboard.resize: 'none'`, so
   opening the keyboard can't squish or jump the layout. Instead the app lifts its own input
   by the keyboard's exact height — `src/services/native/capacitor.ts` listens to
   `keyboardWillShow`, and `src/app/chat.tsx` adds `paddingBottom = keyboardHeight`.
2. **No `‹ › Done` accessory bar.** The bridge calls `Keyboard.setAccessoryBarVisible(false)`.
3. **No white bar.** The bridge overlays the status bar (`StatusBar.setOverlaysWebView`) and
   `scripts/patch-web-viewport.mjs` adds `viewport-fit=cover` to the exported HTML, so the
   gradient runs edge-to-edge and `env(safe-area-inset-*)` resolves for real device insets.

The companion also stays visible while typing: the big hero orb collapses and a compact
avatar fades into the header (conversation mode), so the chat + docked input get the room.

All of the above **no-ops in a plain browser** (the bridge checks `window.Capacitor`), so the
normal `npm run web` dev flow is unchanged.

## Already done (in this repo)

- Capacitor 8 deps installed (`@capacitor/{core,cli,ios,android,keyboard,status-bar}`).
- `capacitor.config.ts` — `webDir: dist`, keyboard `resize: 'none'`, status-bar overlay, background colour.
- `scripts/patch-web-viewport.mjs` — re-adds `viewport-fit=cover` after each export.
- npm scripts: `build:web`, `cap:sync`, `cap:ios`, `cap:android`.
- The web → `dist/` pipeline is validated (`npm run build:web` produces a patched SPA).

## One-time prerequisites (your machine)

These tools are **not** on the current dev machine — install them where you'll build:

- **iOS:** Xcode (present) **+ CocoaPods** — `brew install cocoapods` (or `sudo gem install cocoapods`).
- **Android:** [Android Studio](https://developer.android.com/studio) + an SDK; set `ANDROID_HOME`.

## First-time native setup

```sh
npm run build:web          # export the web app to dist/ (+ viewport patch)
npx cap add ios            # creates ./ios   (needs CocoaPods)
npx cap add android        # creates ./android (needs Android Studio/SDK)
```

`./ios` and `./android` are **git-ignored** — they're generated, regenerable native projects,
not source. Re-run `cap add` anytime to recreate them.

## Everyday loop

After any JS/UI change, push it into the native projects and open the IDE:

```sh
npm run cap:ios            # build:web → cap sync → open Xcode
npm run cap:android        # build:web → cap sync → open Android Studio
# or just sync without opening:
npm run cap:sync
```

Then Run from Xcode / Android Studio onto a simulator or device.

## Verify on device

The whole point — confirm on a real phone (a simulator is fine for most):

- [ ] **No white bar** at the top; the gradient runs under the status bar.
- [ ] **No `‹ › Done`** accessory bar above the keyboard.
- [ ] Opening the keyboard **does not jump or squish** the layout.
- [ ] The companion **stays visible** (collapses to the header avatar) while typing.
- [ ] The input sits **flush above the keyboard** (tune `keyboardHeight` handling if there's a gap).
- [ ] Safe-area insets look right (content clears the notch / home indicator).

## Notes & caveats

- **`appId`** in `capacitor.config.ts` is a placeholder (`health.gig.scimagotchi`) — set your real
  bundle id before submitting to the stores.
- **SQLite:** the app uses `expo-sqlite`, which runs as WebAssembly in the WebView. If the DB
  fails to open on device, that's the first place to look (it may need the wasm asset served
  and/or cross-origin-isolation headers — verify on first native run).
- **Native-only deps** (`@expo/ui`, `expo-glass-effect`, `expo-symbols`) are currently unused;
  they have no effect in the web/Capacitor build.
- The **custom-keyboard prototype** (`/keyboard-demo`, `CustomKeyboard.tsx`) is a separate
  exploration and is **not** part of this wrap — the wrap keeps the real native keyboard.
