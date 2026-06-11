import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/GradientBackground';
import { Glass } from '@/components/Glass';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { useGoBack } from '@/hooks/useGoBack';
import { enterItem } from '@/theme/motion';
import { palette, radii, spacing } from '@/theme/tokens';
import { tintPair } from '@/utils/color';

const ITEMS: { label: string; icon: keyof typeof Feather.glyphMap; route: Href; hint: string; tint: string }[] = [
  { label: 'Memory', icon: 'calendar', route: '/memory', hint: 'Your emotional record', tint: '#6E8BF5' },
  { label: 'Patterns', icon: 'activity', route: '/patterns', hint: 'Weekly reflections', tint: '#9E6CF1' },
  { label: 'Therapy notes', icon: 'file-text', route: '/export', hint: 'Export a PDF summary', tint: '#E07BB0' },
  { label: 'Support', icon: 'life-buoy', route: '/support', hint: 'Help & resources', tint: '#EF7E6B' },
  { label: 'Settings', icon: 'sliders', route: '/settings', hint: 'Privacy & preferences', tint: '#5FBFA6' },
];

export default function MenuScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  return (
    <View style={styles.root}>
      <GradientBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.bar}>
          <IconButton name="chevron-left" onPress={goBack} />
          <Txt variant="subtitle">Menu</Txt>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.list}>
          {ITEMS.map((item, i) => (
            <Animated.View key={item.label} entering={enterItem(i)}>
            <PressableScale onPress={() => router.push(item.route)} scaleTo={0.97}>
              <Glass radius={radii.lg} contentStyle={styles.row}>
                <LinearGradient colors={tintPair(item.tint)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconWrap}>
                  <Feather name={item.icon} size={19} color={palette.white} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Txt variant="label" color={palette.inkOnGlass}>
                    {item.label}
                  </Txt>
                  <Txt variant="small" color={palette.inkSoft}>
                    {item.hint}
                  </Txt>
                </View>
                <Feather name="chevron-right" size={20} color={palette.inkSoft} />
              </Glass>
            </PressableScale>
            </Animated.View>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  bar: {
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: { marginTop: spacing.xl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 10px rgba(95,90,160,0.20)',
  },
});
