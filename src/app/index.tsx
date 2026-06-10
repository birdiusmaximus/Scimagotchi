import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatInput } from '@/components/ChatInput';
import { CompanionOrb } from '@/components/CompanionOrb';
import { GradientBackground } from '@/components/GradientBackground';
import { ReturningThread } from '@/components/ReturningThread';
import { SuggestionChip } from '@/components/SuggestionChip';
import { TopBar } from '@/components/TopBar';
import { Txt } from '@/components/Txt';
import type { CompanionVisualState } from '@/services/ai/companionVisualState';
import { useStore } from '@/state/store';
import { palette, spacing } from '@/theme/tokens';

/** Start a fresh conversation, then either greet (chip) or send the typed text. */
function openChat(kind: 'greet' | 'say', text: string, go: (cid: string) => void) {
  const s = useStore.getState();
  s.newConversation(); // sets conversationId synchronously
  const cid = useStore.getState().conversationId as string;
  if (kind === 'greet') s.greet(text);
  else s.send(text);
  go(cid);
}

const CHIPS: { icon: keyof typeof Feather.glyphMap; label: string; opener: string }[] = [
  {
    icon: 'cloud',
    label: 'I feel off',
    opener: 'I’m here. We can start anywhere — what feels most present right now?',
  },
  {
    icon: 'zap',
    label: 'Vent a little',
    opener: 'Go ahead — tell me what happened, in your own words. I’m listening.',
  },
  {
    icon: 'help-circle',
    label: 'I’m not sure',
    opener: 'That’s allowed. We don’t need the right word yet. Is it more heavy, tense, blank, or restless?',
  },
  {
    icon: 'sun',
    label: 'Checking in',
    opener: 'I’m glad you’re here. How are you feeling right now?',
  },
];

/** A tentative, comparison-not-assertion callback to a kept memory (§12.5). */
function returningOpener(summary: string): string {
  return `When we last talked, you kept this: “${summary.replace(/[.\s]+$/, '')}.” Want to stay with that thread, or is today something else?`;
}

/** Now — the companion home. Matches the v0.1 visual reference. */
export default function NowScreen() {
  const router = useRouter();
  const userName = useStore((s) => s.userName);
  const progress = useStore((s) => s.progress);
  const memoryCards = useStore((s) => s.memoryCards);
  const [threadDismissed, setThreadDismissed] = useState(false);

  // The orb quietly reflects how far the companion has grown — a learned texture,
  // not a mood it imposes on you (engine brief §13, §18). No tint on the home orb.
  const homeVisual: CompanionVisualState = useMemo(() => {
    const rows = Object.values(progress).filter(Boolean);
    if (rows.some((p) => p!.current_stage === 'deepened')) return 'deepened';
    if (rows.some((p) => p!.current_stage === 'returning')) return 'returning_shape';
    return 'idle_calm';
  }, [progress]);

  // The most recent memory the user chose to keep — offered as a gentle thread.
  const lastMemory = useMemo(() => {
    const saved = memoryCards.filter(
      (c) => (c.confirmation_status === 'user_confirmed' || c.confirmation_status === 'user_edited') && c.muted !== 1,
    );
    saved.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return saved[0] ?? null;
  }, [memoryCards]);

  const go = (cid: string) => router.push({ pathname: '/chat', params: { cid } });

  return (
    <View style={styles.root}>
      <GradientBackground />
      <SafeAreaView style={styles.safe}>
        <TopBar onLeft={() => router.push('/menu')} onRight={() => router.push('/settings')} />

        <View style={styles.greeting}>
          <Txt variant="subtitle" align="center">
            Hello{userName ? `, ${userName}` : ''}
          </Txt>
          <Txt variant="h1" align="center">
            How are you feeling today?
          </Txt>
        </View>

        {lastMemory && !threadDismissed ? (
          <ReturningThread
            summary={lastMemory.summary}
            onPickUp={() => openChat('greet', returningOpener(lastMemory.summary), go)}
            onDismiss={() => setThreadDismissed(true)}
          />
        ) : null}

        <View style={styles.orbWrap}>
          <CompanionOrb size={160} interactive visual={homeVisual} />
        </View>

        <View style={styles.chips}>
          {CHIPS.map((c) => (
            <SuggestionChip key={c.label} icon={c.icon} label={c.label} onPress={() => openChat('greet', c.opener, go)} />
          ))}
        </View>

        <ChatInput onSubmit={(t) => openChat('say', t, go)} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  greeting: {
    gap: 4,
    marginTop: spacing.xs,
  },
  orbWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
