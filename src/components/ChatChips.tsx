import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { palette, radii } from '@/theme/tokens';

/**
 * Low-friction continuation chips offered after the companion reflects without
 * asking a question (engine brief §7.3, §16.2). One tap to keep going, keep a
 * moment, gently correct, or close — agency without typing.
 */
export function ChatChips({
  canSave,
  onKeepGoing,
  onSave,
  onNotQuite,
  onDone,
}: {
  canSave: boolean;
  onKeepGoing: () => void;
  onSave: () => void;
  onNotQuite: () => void;
  onDone: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.row}>
      <Chip label="Keep going" onPress={onKeepGoing} />
      {canSave ? <Chip label="Save this" onPress={onSave} /> : null}
      <Chip label="Not quite" onPress={onNotQuite} />
      <Chip label="I’m done" onPress={onDone} />
    </Animated.View>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.94}>
      <Glass radius={radii.pill} fill={palette.glassFill} contentStyle={styles.chip}>
        <Txt variant="small" color={palette.inkOnGlass}>
          {label}
        </Txt>
      </Glass>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 2, paddingBottom: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 14 },
});
