import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/GradientBackground';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { palette, spacing } from '@/theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
};

/** Shared scaffold for sections not yet built out in v0.1. */
export function PlaceholderScreen({ title, subtitle }: Props) {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <GradientBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.bar}>
          <IconButton name="chevron-left" onPress={() => router.back()} />
        </View>
        <View style={styles.body}>
          <Txt variant="h1" align="center">
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="body" color={palette.inkSoft} align="center">
              {subtitle}
            </Txt>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  bar: { paddingTop: spacing.sm, flexDirection: 'row' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingBottom: spacing.xxl },
});
