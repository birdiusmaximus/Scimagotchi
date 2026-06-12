import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Glass } from '@/components/Glass';
import { IconButton } from '@/components/IconButton';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { fontFamily, palette, radii, spacing } from '@/theme/tokens';

type Props = {
  placeholder?: string;
  onSubmit?: (text: string) => void;
  /** Focus on mount (chat keeps the keyboard/caret ready for continuous typing). */
  autoFocus?: boolean;
  /** Bump this whenever the companion replies, to re-focus so typing can continue. */
  refocusSignal?: number;
};

/** The always-visible chat input pill: + button · text field · mic/send. */
export function ChatInput({ placeholder = 'What’s here?', onSubmit, autoFocus, refocusSignal }: Props) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const hasText = text.trim().length > 0;

  // Tap-and-talk: the mic streams a live transcript into the field; the user reviews
  // and sends. Web uses the browser Speech API; native reports unsupported (mic hidden).
  const speech = useSpeechRecognition({ onResult: (t) => setText(t) });

  // A soft radar pulse around the button while it's listening.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (speech.listening) {
      pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.ease) }), -1, false);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [speech.listening, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.6 }], opacity: 0.4 * (1 - pulse.value) }));

  // Focus on mount. The `autoFocus` DOM attribute only fires on a full page load,
  // not on client-side navigation, so focus explicitly here too.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Keep the field active after each companion reply so the user can keep typing.
  useEffect(() => {
    if (refocusSignal && refocusSignal > 0) inputRef.current?.focus();
  }, [refocusSignal]);

  const submit = () => {
    if (!hasText) return;
    onSubmit?.(text.trim());
    setText('');
    // Stay focused so the user can keep typing without tapping the field again.
    inputRef.current?.focus();
  };

  return (
    <Glass
      radius={radii.pill}
      fill={palette.glassFillStrong}
      contentStyle={styles.row}
    >
      <View style={styles.plus}>
        <Feather name="plus" size={18} color={palette.inkOnGlass} />
      </View>
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor="rgba(110,108,155,0.5)"
        style={styles.input}
        onSubmitEditing={submit}
        submitBehavior="submit"
        autoFocus={autoFocus}
        returnKeyType="send"
        multiline={false}
      />
      <View style={styles.action}>
        {speech.listening ? <Animated.View pointerEvents="none" style={[styles.pulseRing, pulseStyle]} /> : null}
        <IconButton
          name={speech.listening ? 'square' : hasText ? 'arrow-up' : 'mic'}
          variant="accent"
          diameter={40}
          iconSize={speech.listening ? 15 : 18}
          onPress={speech.listening ? speech.stop : hasText ? submit : speech.supported ? speech.start : submit}
        />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 8,
  },
  plus: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  action: { alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(158,108,241,0.5)',
  },
  input: {
    flex: 1,
    fontFamily,
    fontSize: 16,
    color: palette.ink,
    paddingVertical: 6,
    outlineStyle: 'none', // web-only: remove the default focus ring
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
});
