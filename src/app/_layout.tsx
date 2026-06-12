import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaInsetsContext, SafeAreaProvider, type EdgeInsets } from 'react-native-safe-area-context';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

import { SafetyModal } from '@/components/SafetyModal';
import { WeeklySummaryModal } from '@/components/WeeklySummaryModal';
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
  if (Platform.OS !== 'web') return <>{children}</>;
  // Real mobile browsers report true safe-area insets (and zero the bottom one when
  // the keyboard covers the home indicator) — only desktop (a fine pointer) reports
  // none. So feed iPhone-like insets on desktop for a faithful preview, but pass
  // through on touch devices so a real phone uses its own insets.
  const isDesktop = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)')?.matches;
  if (!isDesktop) return <>{children}</>;
  return <SafeAreaInsetsContext.Provider value={WEB_PREVIEW_INSETS}>{children}</SafeAreaInsetsContext.Provider>;
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

  // Mobile web: track the visual viewport so the on-screen keyboard COMPRESSES the
  // layout (companion + chat + input fit just above it) instead of pushing content
  // off the top of the page. Drives the #root height var defined in global.css.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        root.style.setProperty('--app-height', `${Math.round(vv.height)}px`);
        if (window.scrollY !== 0) window.scrollTo(0, 0); // keep the app pinned to the top
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
