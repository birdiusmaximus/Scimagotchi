import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomKeyboard } from '@/components/CustomKeyboard';
import { GradientBackground } from '@/components/GradientBackground';
import { Glass } from '@/components/Glass';
import { Txt } from '@/components/Txt';
import { useGoBack } from '@/hooks/useGoBack';
import { IconButton } from '@/components/IconButton';
import { fontFamily, palette, radii, spacing } from '@/theme/tokens';

/**
 * PROTOTYPE sandbox (route: /keyboard-demo) — exploring the custom in-app keyboard.
 * No OS keyboard is ever summoned, so the layout is fully app-controlled: the companion
 * stays visible as a small header, the chat scrolls, and the input + keyboard are docked
 * at the bottom with no Safari accessory bar, no viewport squish, no jump. Not wired into
 * the live chat — this is purely to FEEL the trade-off (control vs. typing experience).
 */
type Msg = { role: 'user' | 'companion'; text: string };

export default function KeyboardDemo() {
  const goBack = useGoBack();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'companion', text: 'Down makes sense. We can stay with just that for a moment.' },
  ]);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setMessages((m) => [...m, { role: 'user', text: t }, { role: 'companion', text: 'I hear you. Tell me a little more about that.' }]);
    setDraft('');
  };

  return (
    <View style={styles.root}>
      <GradientBackground families={[]} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Small persistent companion — always visible while typing (conversation mode). */}
        <View style={styles.header}>
          <IconButton name="chevron-left" onPress={goBack} />
          <View style={styles.miniOrb}>
            <View style={styles.eye} />
            <View style={styles.eye} />
          </View>
          <Txt variant="body" color={palette.inkOnGlass}>
            Scimagotchi · prototype keyboard
          </Txt>
        </View>

        {/* Conversation — fills the space and scrolls. */}
        <ScrollView style={styles.flex} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleCompanion]}>
              <Txt variant="body" color={m.role === 'user' ? '#fff' : palette.inkOnGlass}>
                {m.text}
              </Txt>
            </View>
          ))}
        </ScrollView>

        {/* Input pill — the typed draft (no TextInput, so the OS keyboard never opens). */}
        <Pressable style={styles.inputWrap}>
          <Glass radius={radii.pill} fill={palette.glassFillStrong} contentStyle={styles.inputRow}>
            <Txt variant="body" color={draft ? palette.ink : 'rgba(110,108,155,0.6)'} style={styles.draft}>
              {draft || 'What’s here?'}
            </Txt>
          </Glass>
        </Pressable>

        {/* The app-owned keyboard, docked. */}
        <CustomKeyboard value={draft} onChange={setDraft} onSubmit={send} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.md },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  miniOrb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  eye: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  messages: { paddingVertical: spacing.md, gap: spacing.sm },
  bubble: { maxWidth: '85%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: radii.lg },
  bubbleCompanion: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.55)' },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: palette.accent },
  inputWrap: { paddingBottom: spacing.xs },
  inputRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 16 },
  draft: { flex: 1, fontFamily },
});
