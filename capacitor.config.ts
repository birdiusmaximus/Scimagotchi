import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

/**
 * Capacitor wrap — ships the Expo *web* export (`dist/`, an SPA via app.json
 * web.output:"single") inside native iOS/Android WebView shells.
 *
 * The keyboard fix lives here + in src/services/native/capacitor.ts:
 *  - resize:'none' → the WebView NEVER resizes when the keyboard opens, so the layout
 *    can't jump or squish; the app lifts its own input by the plugin-reported height.
 *  - The runtime bridge hides the iOS accessory bar and overlays the status bar so the
 *    gradient runs edge-to-edge (no white bar). viewport-fit=cover is patched into the
 *    exported index.html by scripts/patch-web-viewport.mjs so env(safe-area-*) resolves.
 *
 * appId is a placeholder reverse-DNS id — change it to your real bundle identifier
 * before shipping to the App Store / Play Store.
 */
const config: CapacitorConfig = {
  appId: 'health.gig.scimagotchi',
  appName: 'Scimagotchi',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: KeyboardResize.None,
      resizeOnFullScreen: true, // Android: still report height in fullscreen
    },
  },
  ios: {
    // We own the safe-area insets via env() in CSS, so don't let the WebView inset content.
    contentInset: 'never',
    backgroundColor: '#E7E0FFff', // bgTop — no white flash behind the gradient
  },
  android: {
    backgroundColor: '#E7E0FFff',
  },
};

export default config;
