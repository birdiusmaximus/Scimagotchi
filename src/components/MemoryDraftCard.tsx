import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { fontFamily, palette, radii, spacing } from '@/theme/tokens';
import type { MemoryCard } from '@/types/models';

type Props = {
  draft: MemoryCard;
  onSave: () => void;
  onEdit: (summary: string) => void;
  onReject: () => void;
};

/**
 * The memory-consent moment (engine brief §12.3): the companion proposes one
 * small thing it learned; the person chooses Save / Edit / Not this. Nothing
 * becomes durable memory without this card.
 */
export function MemoryDraftCard({ draft, onSave, onEdit, onReject }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.summary);

  return (
    <Animated.View entering={FadeInDown.springify().damping(18).mass(0.7)} exiting={FadeOutDown.duration(180)}>
      <Glass radius={radii.lg} fill={palette.glassFillStrong} style={styles.card} contentStyle={styles.content}>
        <View style={styles.headerRow}>
          <Feather name="feather" size={14} color={palette.accentDeep} />
          <Txt variant="small" color={palette.inkSoft} style={styles.kicker}>
            SOMETHING I LEARNED — KEEP IT?
          </Txt>
        </View>

        {editing ? (
          <TextInput
            value={text}
            onChangeText={setText}
            style={styles.input}
            multiline
            autoFocus
            placeholder="Put it in your own words…"
            placeholderTextColor={palette.inkSoft}
          />
        ) : (
          <Txt variant="body" color={palette.inkOnGlass} style={styles.summary}>
            {draft.summary}
          </Txt>
        )}

        <View style={styles.actions}>
          {editing ? (
            <PressableScale onPress={() => onEdit(text)} style={[styles.btn, styles.btnSolid]}>
              <Txt variant="label" color={palette.white}>
                Keep this version
              </Txt>
            </PressableScale>
          ) : (
            <>
              <PressableScale onPress={onSave} style={[styles.btn, styles.btnSolid]}>
                <Txt variant="label" color={palette.white}>
                  Save
                </Txt>
              </PressableScale>
              <PressableScale onPress={() => setEditing(true)} style={[styles.btn, styles.btnGhost]}>
                <Txt variant="label" color={palette.accentDeep}>
                  Edit
                </Txt>
              </PressableScale>
            </>
          )}
          <PressableScale onPress={onReject} style={[styles.btn, styles.btnGhost]}>
            <Txt variant="label" color={palette.inkSoft}>
              Not this
            </Txt>
          </PressableScale>
        </View>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 2, marginBottom: spacing.xs },
  content: { paddingVertical: 12, paddingHorizontal: spacing.md, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { letterSpacing: 1.2 },
  summary: { lineHeight: 21 },
  input: {
    fontFamily,
    fontSize: 15,
    color: palette.ink,
    lineHeight: 21,
    paddingVertical: 4,
    outlineStyle: 'none', // web-only: remove focus ring
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  btn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: radii.pill, alignItems: 'center' },
  btnSolid: { backgroundColor: palette.accent },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.6)' },
});
