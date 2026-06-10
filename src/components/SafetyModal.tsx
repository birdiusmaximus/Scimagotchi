import { Feather } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Txt } from '@/components/Txt';
import { UK_SUPPORT_ROUTES, type SupportRoute } from '@/data/safetyResources';
import { radii, spacing } from '@/theme/tokens';

type Props = {
  visible: boolean;
  level: number;
  onDismiss: () => void;
};

// Deliberately sober palette — neutral, non-cute, non-gamified (brief §17.1).
const NEUTRAL = {
  bg: '#F4F5F8',
  ink: '#23232B',
  inkSoft: '#5A5B66',
  line: '#E1E2E8',
  card: '#FFFFFF',
};

function openRoute(route: SupportRoute) {
  const { type, value } = route.action;
  const url = type === 'url' ? value : type === 'sms' ? `sms:${value}` : `tel:${value}`;
  Linking.openURL(url).catch(() => {});
}

/**
 * Full-screen safety overlay (brief §17.4). Rendered in-tree (not RN Modal) so it
 * stays inside the app surface and reliably constrains layout. Acknowledge →
 * limitation → urgent action → support routes → dismissible after support shows.
 */
export function SafetyModal({ visible, level, onDismiss }: Props) {
  if (!visible) return null;
  const urgent = level >= 4;

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Txt variant="subtitle" color={NEUTRAL.ink}>
            {urgent ? 'This sounds urgent' : 'Let’s pause for a moment'}
          </Txt>

          <Txt variant="body" color={NEUTRAL.inkSoft} style={styles.para}>
            {urgent
              ? 'I’m sorry this is happening. If you might act on this now, or you or someone else is in immediate danger, call 999 now or go to A&E.'
              : 'I’m sorry you’re dealing with this. I need to pause our usual chat and show support options. If you feel at risk of harming yourself, please contact urgent support.'}
          </Txt>

          <Txt variant="small" color={NEUTRAL.inkSoft} style={styles.para}>
            I’m a reflection companion, not a crisis service — I can’t keep you safe, but these people can help right now.
          </Txt>

          <View style={styles.routes}>
            {UK_SUPPORT_ROUTES.map((route) => (
              <Pressable
                key={route.label}
                onPress={() => openRoute(route)}
                style={({ pressed }) => [styles.route, { opacity: pressed ? 0.7 : 1 }]}
              >
                <View style={styles.routeText}>
                  <Txt variant="label" color={NEUTRAL.ink}>
                    {route.label}
                  </Txt>
                  <Txt variant="small" color={NEUTRAL.inkSoft}>
                    {route.detail}
                  </Txt>
                </View>
                <Feather name="phone" size={18} color={NEUTRAL.inkSoft} />
              </Pressable>
            ))}
          </View>

          <Pressable onPress={onDismiss} style={({ pressed }) => [styles.dismiss, { opacity: pressed ? 0.6 : 1 }]}>
            <Txt variant="label" color={NEUTRAL.inkSoft}>
              Close and return
            </Txt>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NEUTRAL.bg,
    zIndex: 1000,
    elevation: 1000,
  },
  safe: { flex: 1 },
  scroll: {
    padding: spacing.xl,
    gap: spacing.sm,
    flexGrow: 1,
    justifyContent: 'center',
  },
  para: { marginTop: spacing.xs },
  routes: { marginTop: spacing.lg, gap: spacing.sm },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: NEUTRAL.card,
    borderWidth: 1,
    borderColor: NEUTRAL.line,
    borderRadius: radii.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
  },
  routeText: { flex: 1 },
  dismiss: { marginTop: spacing.xl, alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
});
