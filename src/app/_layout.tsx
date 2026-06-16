import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Keyboard, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaInsetsContext, SafeAreaProvider, type EdgeInsets } from 'react-native-safe-area-context';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

import { SafetyModal } from '@/components/SafetyModal';
import { WeeklySummaryModal } from '@/components/WeeklySummaryModal';
import { initNativeKeyboard, initStatusBarOverlay, isCapacitorNative } from '@/services/native/capacitor';
import { useStore } from '@/state/store';
import { palette } from '@/theme/tokens';

// Quieten Reanimated's strict-mode render warnings (animations use worklets).
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

/**
 * A desktop browser reports zero safe-area insets, so the web preview would jam
 * the top bar against the edge and under-represent device spacing. To keep the
 * preview faithful for layout decisions, we feed it iPhone-like insets (Dynamic
 * Island top + home-indicator bottom). Native is untouched — it uses the real
 * device insets measured by SafeAreaProvider.
 */
const WEB_PREVIEW_INSETS: EdgeInsets = { top: 59, bottom: 34, left: 0, right: 0 };

function PreviewSafeArea({ children }: { children: ReactNode }) {
  const keyboardOpen = useStore((s) => s.keyboardOpen);
  if (Platform.OS !== 'web') return <>{children}</>;
  // Inside the Capacitor shell the WebView is a real device surface, so let the actual
  // env(safe-area-inset-*) values flow through (viewport-fit=cover is patched into the
  // exported HTML) instead of the desktop preview's faked iPhone insets.
  if (isCapacitorNative()) return <>{children}</>;
  // Web gets fixed iPhone-like insets (Expo Router controls the viewport meta itself and
  // drops a custom `viewport-fit=cover`, so real iOS env() insets would resolve to 0 and
  // jam the top bar against the notch). BUT when the keyboard is open it covers the home
  // indicator, so the bottom inset should be 0 — that docks the input to the keyboard
  // instead of leaving a dead gap, and hands those pixels back to the companion.
  const insets: EdgeInsets = {
    top: WEB_PREVIEW_INSETS.top,
    bottom: keyboardOpen ? 0 : WEB_PREVIEW_INSETS.bottom,
    left: 0,
    right: 0,
  };
  return <SafeAreaInsetsContext.Provider value={insets}>{children}</SafeAreaInsetsContext.Provider>;
}

export default function RootLayout() {
  const safety = useStore((s) => s.safety);
  const weekly = useStore((s) => s.weekly);

  useEffect(() => {
    useStore.getState().init();
    // Load the Adobe Fonts (Typekit) kit on web. +html.tsx covers static export,
    // but Expo's dev server doesn't apply it, so inject the stylesheet at runtime.
    if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('typekit-abe4vwg')) {
      const link = document.createElement('link');
      link.id = 'typekit-abe4vwg';
      link.rel = 'stylesheet';
      link.href = 'https://use.typekit.net/abe4vwg.css';
      document.head.appendChild(link);
    }
  }, []);

  // Capacitor native shell: drive the keyboard state from the plugin. The WebView is
  // set to resize:'none' so the visual viewport below never moves (that's what removes
  // the jump) — the layout lifts its own content by keyboardHeight instead. Also overlay
  // the status bar so the gradient runs edge-to-edge (no white bar).
  useEffect(() => {
    if (!isCapacitorNative()) return;
    initStatusBarOverlay();
    let cleanup = () => {};
    initNativeKeyboard({
      setOpen: (open) => {
        if (open !== useStore.getState().keyboardOpen) useStore.setState({ keyboardOpen: open });
      },
      setHeight: (h) => {
        if (h !== useStore.getState().keyboardHeight) useStore.setState({ keyboardHeight: h });
      },
    }).then((c) => {
      cleanup = c;
    });
    return () => cleanup();
  }, []);

  // Native (iOS/Android built via EAS/prebuild — NOT web, NOT the Capacitor WebView): drive the
  // keyboard state from React Native's own Keyboard events, so conversation mode collapses the
  // hero orb and the input lifts by the keyboard height. (Web uses the visual-viewport handler;
  // the Capacitor shell uses its plugin above — those are no-ops here on a real native runtime.)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      useStore.setState({ keyboardOpen: true, keyboardHeight: Math.round(e.endCoordinates?.height ?? 0) });
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      useStore.setState({ keyboardOpen: false, keyboardHeight: 0 });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Mobile web (plain browser): track the visual viewport so the on-screen keyboard
  // COMPRESSES the layout (companion + chat + input fit just above it) instead of pushing
  // content off the top of the page. Drives the #root height var defined in global.css.
  // Skipped under Capacitor, where resize:'none' means the viewport wouldn't move anyway.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport || isCapacitorNative()) return;
    const vv = window.visualViewport;
    const root = document.documentElement;
    let raf = 0;
    let maxH = vv.height; // the no-keyboard height baseline (grows if the URL bar hides)
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        maxH = Math.max(maxH, vv.height);
        root.style.setProperty('--app-height', `${Math.round(vv.height)}px`);
        if (window.scrollY !== 0) window.scrollTo(0, 0); // keep the app pinned to the top
        // The keyboard takes a big bite out of the viewport; a small URL-bar change does not.
        const open = vv.height < maxH - 120;
        if (open !== useStore.getState().keyboardOpen) useStore.setState({ keyboardOpen: open });
      });
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PreviewSafeArea>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.bgTop },
              animation: 'fade',
            }}
          />
          {weekly ? (
            <WeeklySummaryModal summary={weekly} onClose={() => useStore.getState().dismissWeekly()} />
          ) : null}
          <SafetyModal
            visible={safety.visible}
            level={safety.level}
            onDismiss={() => useStore.getState().dismissSafety()}
          />
        </PreviewSafeArea>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
