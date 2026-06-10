import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/GradientBackground';
import { Glass } from '@/components/Glass';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { useGoBack } from '@/hooks/useGoBack';
import { palette, radii, spacing } from '@/theme/tokens';

const ITEMS: { label: string; icon: keyof typeof Feather.glyphMap; route: Href; hint: string }[] = [
  { label: 'Memory', icon: 'calendar', route: '/memory', hint: 'Your emotional record' },
  { label: 'Patterns', icon: 'activity', route: '/patterns', hint: 'Weekly reflections' },
  { label: 'Therapy notes', icon: 'file-text', route: '/export', hint: 'Export a PDF summary' },
  { label: 'Support', icon: 'life-buoy', route: '/support', hint: 'Help & resources' },
  { label: 'Settings', icon: 'sliders', route: '/settings', hint: 'Privacy & preferences' },
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
          {ITEMS.map((item) => (
            <PressableScale key={item.label} onPress={() => router.push(item.route)} scaleTo={0.97}>
              <Glass radius={radii.lg} contentStyle={styles.row}>
                <View style={styles.iconWrap}>
                  <Feather name={item.icon} size={20} color={palette.accentDeep} />
                </View>
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
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});
