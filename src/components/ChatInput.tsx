import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { IconButton } from '@/components/IconButton';
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
      <IconButton
        name={hasText ? 'arrow-up' : 'mic'}
        variant="accent"
        diameter={40}
        iconSize={18}
        onPress={submit}
      />
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
