import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { fontFamily, palette, radii, spacing } from '@/theme/tokens';

/**
 * PROTOTYPE in-app keyboard (exploration only — not wired into the live chat).
 * The whole point: the OS keyboard never opens, so the APP owns the full layout —
 * no Safari accessory bar, no viewport squish, no jump. Trade-off to judge here is
 * typing feel vs. that control. Controlled: parent owns the text.
 */
type Props = {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
};

const LETTER_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];
const SYMBOL_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['-', '/', ':', ';', '(', ')', '£', '&', '@'],
  ['.', ',', '?', '!', "'", '"'],
];

export function CustomKeyboard({ value, onChange, onSubmit }: Props) {
  const [shift, setShift] = useState(true); // start capitalised, like iOS
  const [symbols, setSymbols] = useState(false);

  const insert = (ch: string) => {
    onChange(value + (shift && !symbols ? ch.toUpperCase() : ch));
    if (shift && !symbols) setShift(false); // one-shot shift
  };
  const backspace = () => onChange(value.slice(0, -1));

  const rows = symbols ? SYMBOL_ROWS : LETTER_ROWS;

  return (
    <View style={styles.kbd}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {/* shift sits at the start of the last letter row */}
          {i === 2 && !symbols ? (
            <Key wide onPress={() => setShift((s) => !s)} active={shift}>
              <Feather name="arrow-up" size={18} color={shift ? palette.inkOnGlass : palette.inkSoft} />
            </Key>
          ) : null}

          {row.map((ch) => (
            <Key key={ch} onPress={() => insert(ch)}>
              <Text style={styles.keyLabel}>{shift && !symbols ? ch.toUpperCase() : ch}</Text>
            </Key>
          ))}

          {/* backspace closes the last letter / symbol row */}
          {i === 2 ? (
            <Key wide onPress={backspace}>
              <Feather name="delete" size={18} color={palette.inkSoft} />
            </Key>
          ) : null}
        </View>
      ))}

      <View style={styles.row}>
        <Key wide onPress={() => setSymbols((s) => !s)}>
          <Text style={styles.keySmall}>{symbols ? 'ABC' : '123'}</Text>
        </Key>
        <Key flex onPress={() => insert(' ')}>
          <Text style={styles.keySmall}>space</Text>
        </Key>
        <Key wide accent onPress={onSubmit}>
          <Feather name="arrow-up" size={18} color="#fff" />
        </Key>
      </View>
    </View>
  );
}

function Key({
  children,
  onPress,
  wide,
  flex,
  accent,
  active,
}: {
  children: React.ReactNode;
  onPress: () => void;
  wide?: boolean;
  flex?: boolean;
  accent?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        wide && styles.keyWide,
        flex && styles.keyFlex,
        accent && styles.keyAccent,
        active && styles.keyActive,
        pressed && styles.keyPressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kbd: { paddingHorizontal: 4, paddingTop: 8, paddingBottom: 10, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  key: {
    flex: 1,
    height: 46,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    maxWidth: 44,
  },
  keyWide: { maxWidth: 56, flex: 1.4 },
  keyFlex: { maxWidth: 240, flex: 4 },
  keyAccent: { backgroundColor: palette.accent },
  keyActive: { backgroundColor: 'rgba(158,108,241,0.28)' },
  keyPressed: { opacity: 0.6, transform: [{ scale: 0.96 }] },
  keyLabel: { fontFamily, fontSize: 20, color: palette.ink },
  keySmall: { fontFamily, fontSize: 13, color: palette.inkSoft },
});
