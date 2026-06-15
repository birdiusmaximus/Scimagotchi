import { Platform } from 'react-native';

/**
 * Capacitor bridge — wires the NATIVE keyboard + status bar to the app layout when
 * the web build is running inside a Capacitor shell (the iOS/Android wrap).
 *
 * Deliberately accessed through the runtime global (`window.Capacitor`) rather than
 * importing `@capacitor/*` packages, so the plain web bundle carries no Capacitor
 * build dependency and every export below cleanly no-ops in a normal browser. The
 * native plugins are injected by the shell at runtime; the config (capacitor.config.ts)
 * sets resize:'none' so the WebView never squishes — instead the layout lifts its own
 * content by `keyboardHeight`, which is what kills the jump.
 */

type KeyboardInfo = { keyboardHeight?: number };
type ListenerHandle = { remove: () => void };
type KeyboardPlugin = {
  addListener: (event: string, cb: (info: KeyboardInfo) => void) => Promise<ListenerHandle>;
  setAccessoryBarVisible?: (opts: { isVisible: boolean }) => Promise<void>;
};
type StatusBarPlugin = {
  setOverlaysWebView?: (opts: { overlay: boolean }) => Promise<void>;
  setStyle?: (opts: { style: string }) => Promise<void>;
};
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: { Keyboard?: KeyboardPlugin; StatusBar?: StatusBarPlugin };
};

function cap(): CapacitorGlobal | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/** True only inside the Capacitor native shell. Plain mobile/desktop web → false. */
export function isCapacitorNative(): boolean {
  return !!cap()?.isNativePlatform?.();
}

type Setters = { setOpen: (open: boolean) => void; setHeight: (h: number) => void };

/**
 * Subscribe the layout to the native keyboard. Returns a cleanup fn. No-ops (and
 * returns a no-op cleanup) outside the Capacitor shell, where the visual-viewport
 * handler in _layout.tsx drives `keyboardOpen` instead.
 */
export async function initNativeKeyboard({ setOpen, setHeight }: Setters): Promise<() => void> {
  const KB = cap()?.Plugins?.Keyboard;
  if (!isCapacitorNative() || !KB) return () => {};

  // Kill the iOS form-accessory bar — the ‹ › Done strip above the keyboard.
  try {
    await KB.setAccessoryBarVisible?.({ isVisible: false });
  } catch {}

  // resize:'none' means the WebView keeps full height and the keyboard overlays the
  // bottom; the layout lifts the input by this exact height (no squish, no jump).
  const show = await KB.addListener('keyboardWillShow', (info) => {
    setHeight(Math.round(info?.keyboardHeight ?? 0));
    setOpen(true);
  });
  const hide = await KB.addListener('keyboardWillHide', () => {
    setOpen(false);
    setHeight(0);
  });
  return () => {
    try {
      show.remove();
      hide.remove();
    } catch {}
  };
}

/**
 * Let the gradient run edge-to-edge under the status bar (so there's no white bar).
 * Style 'LIGHT' = dark icons, correct for the light lavender wash. No-ops outside Capacitor.
 */
export async function initStatusBarOverlay(): Promise<void> {
  const SB = cap()?.Plugins?.StatusBar;
  if (!isCapacitorNative() || !SB) return;
  try {
    await SB.setOverlaysWebView?.({ overlay: true });
    await SB.setStyle?.({ style: 'LIGHT' });
  } catch {}
}
