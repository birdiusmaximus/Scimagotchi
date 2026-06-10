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
  return <SafeAreaInsetsContext.Provider value={WEB_PREVIEW_INSETS}>{children}</SafeAreaInsetsContext.Provider>;
}

export default function RootLayout() {
  const safety = useStore((s) => s.safety);
  const weekly = useStore((s) => s.weekly);

  useEffect(() => {
    useStore.getState().init();
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
