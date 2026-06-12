import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { palette, radii } from '@/theme/tokens';

/**
 * Low-friction continuation chips offered after the companion reflects without
 * asking a question (engine brief §7.3, §16.2). One tap to keep going, gently
 * correct, or close — agency without typing. They sit on the user's side (right),
 * styled as soft, translucent white bubbles that echo the chat bubbles so they
 * read as a gentle offer rather than three loud buttons.
 */
export function ChatChips({
  onKeepGoing,
  onNotQuite,
  onDone,
}: {
  onKeepGoing: () => void;
  onNotQuite: () => void;
  onDone: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.row}>
      <Chip label="Stay with it" onPress={onKeepGoing} />
      <Chip label="Not quite" onPress={onNotQuite} />
      <Chip label="I’m done" onPress={onDone} />
    </Animated.View>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.94}>
      <View style={styles.chip}>
        <Txt variant="small" color={palette.inkOnGlass}>
          {label}
        </Txt>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Sit on the user's side (right), where their messages land.
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 7, paddingHorizontal: 2, paddingBottom: 8 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: radii.lg,
    borderBottomRightRadius: 8, // echo the user bubble's corner
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
  },
});
