import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';

import { Glass } from '@/components/Glass';
import { Txt } from '@/components/Txt';
import { gradients, palette, radii } from '@/theme/tokens';
import type { Message } from '@/types/models';

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <Animated.View
        entering={FadeInRight.springify().damping(20).mass(0.7)}
        style={[styles.row, styles.rowUser]}
      >
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.userBubble]}
        >
          <Txt variant="body" color={palette.white}>
            {message.content}
          </Txt>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInLeft.springify().damping(20).mass(0.7)}
      style={[styles.row, styles.rowCompanion]}
    >
      <Glass
        radius={radii.lg}
        fill={palette.glassFillStrong}
        style={[styles.bubble, styles.companionBubble]}
        contentStyle={styles.companionContent}
      >
        <Txt variant="body" color={palette.inkOnGlass}>
          {message.content}
        </Txt>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 5 },
  rowUser: { justifyContent: 'flex-end' },
  rowCompanion: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%' },
  userBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    borderBottomRightRadius: 6,
    boxShadow: '0px 8px 18px rgba(155,108,241,0.30)',
  },
  companionBubble: { borderBottomLeftRadius: 6 },
  companionContent: { paddingVertical: 12, paddingHorizontal: 16 },
});
