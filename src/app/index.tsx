import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { learnedFamilies, sequenceDuration } from '@/services/ai/emotionAnimations';
import type { ConversationMode } from '@/services/ai/modeRouter';
import { useStore } from '@/state/store';
import { palette, spacing } from '@/theme/tokens';
import type { EmotionFamilyId } from '@/types/models';

/** Start a fresh conversation, then either greet (chip) or send the typed text. */
function openChat(kind: 'greet' | 'say', text: string, go: (cid: string) => void, entryMode?: ConversationMode) {
  const s = useStore.getState();
  s.newConversation(); // sets conversationId synchronously, clears entryMode
  const cid = useStore.getState().conversationId as string;
  // The chip's stance biases the first companion turn (consumed + cleared in send()).
  if (entryMode) useStore.setState({ entryMode });
  if (kind === 'greet') s.greet(text);
  else s.send(text);
  go(cid);
}

/**
 * Each door sets a distinct stance (engine brief §6): vent → just listen,
 * "off" → help identify it, "not sure" → find it via the body/situation,
 * check-in → light and glad. The opener AND the first turn's mode both follow.
 * Each door has several openers so the same tap doesn't always say the same
 * thing — a small thing that keeps the companion from feeling mechanical.
 */
const CHIPS: { icon: keyof typeof Feather.glyphMap; label: string; openers: string[]; entry: ConversationMode }[] = [
  {
    icon: 'cloud',
    label: 'I feel off',
    entry: 'clarify',
    openers: [
      'Something feels off, and that’s a real place to start. Can you say a little about what’s going on, even roughly?',
      'Off is a real thing to feel. What’s it attached to, if anything comes to mind?',
      'Okay, something isn’t sitting right. Want to start with what happened, or just how it feels?',
      'Let’s start from off, then. What’s been going on today?',
    ],
  },
  {
    icon: 'zap',
    label: 'Vent a little',
    entry: 'witness',
    openers: [
      'Go ahead, say whatever’s there, however it comes out. I’m just here to listen.',
      'I’m listening. Let it out however it wants to come.',
      'No need to make it tidy. Say what’s on your chest.',
      'Okay, vent away. I’m not going anywhere.',
    ],
  },
  {
    icon: 'help-circle',
    label: 'I’m not sure',
    entry: 'body_first',
    openers: [
      'That’s okay, we don’t need a name for it yet. Want to start with what’s been happening, or how it sits in your body?',
      'Not knowing is a fine place to begin. What does it feel like, even roughly, before we name it?',
      'We can leave it unnamed for now. What was going on when you noticed it?',
      'That’s alright. Where do you feel it, or what brought it on?',
    ],
  },
  {
    icon: 'sun',
    label: 'Checking in',
    entry: 'soft_landing',
    openers: [
      'I’m really glad you’re here. What’s on your mind today?',
      'Good to see you. How’s today landing for you?',
      'Hey, glad you checked in. What’s here right now?',
      'Nice to have you. What’s today been like?',
    ],
  },
];

// Remember the last opener used per door so a re-tap never repeats it verbatim.
const lastOpenerIdx: Record<string, number> = {};
function pickOpener(label: string, openers: string[]): string {
  if (openers.length <= 1) return openers[0];
  let i = Math.floor(Math.random() * openers.length);
  if (i === lastOpenerIdx[label]) i = (i + 1) % openers.length;
  lastOpenerIdx[label] = i;
  return openers[i];
}

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

  // ── Double-tap the companion to cycle through the feelings it has learned ─────
  // (animation brief). Plays only learned emotions; never unlocks, writes memory,
  // or sends messages. The home background takes the played (or dominant) hue.
  const learned = useMemo(() => learnedFamilies(progress), [progress]);
  const dominant = useMemo<EmotionFamilyId | null>(() => {
    const rows = learned.map((f) => ({ f, when: progress[f]?.updated_at ?? '' }));
    rows.sort((a, b) => b.when.localeCompare(a.when));
    return rows[0]?.f ?? null;
  }, [learned, progress]);

  const cycleIdx = useRef(0);
  const lockUntil = useRef(0);
  const [playEmotion, setPlayEmotion] = useState<{ key: number; family: EmotionFamilyId } | null>(null);
  const [activePlay, setActivePlay] = useState<EmotionFamilyId | null>(null);

  const onCompanionDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now < lockUntil.current) return; // ignore during play + brief cooldown
    if (!learned.length) return; // nothing learned yet — the orb's pulse is the only feedback
    const fam = learned[cycleIdx.current % learned.length];
    cycleIdx.current = (cycleIdx.current + 1) % learned.length;
    setPlayEmotion((p) => ({ key: (p?.key ?? 0) + 1, family: fam }));
    setActivePlay(fam);
    const dur = sequenceDuration(fam);
    lockUntil.current = now + dur + 900;
    setTimeout(() => setActivePlay((a) => (a === fam ? null : a)), dur + 250);
  }, [learned]);

  // Background reflects the feeling being embodied, else the companion's strongest learned one.
  const bgFamilies = useMemo<EmotionFamilyId[]>(() => {
    const f = activePlay ?? dominant;
    return f ? [f] : [];
  }, [activePlay, dominant]);

  // The most recent memory the user chose to keep — offered as a gentle thread.
  const lastMemory = useMemo(() => {
    const saved = memoryCards.filter(
      (c) =>
        (c.confirmation_status === 'auto_learned' ||
          c.confirmation_status === 'user_confirmed' ||
          c.confirmation_status === 'user_edited') &&
        c.muted !== 1,
    );
    saved.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return saved[0] ?? null;
  }, [memoryCards]);

  const go = (cid: string) => router.push({ pathname: '/chat', params: { cid } });

  return (
    <View style={styles.root}>
      <GradientBackground families={bgFamilies} />
      <SafeAreaView style={styles.safe}>
        <TopBar onLeft={() => router.push('/menu')} onRight={() => router.push('/memory')} />

        <View style={styles.greeting}>
          <Txt variant="h1" align="center">
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
          <CompanionOrb size={160} interactive visual={homeVisual} playEmotion={playEmotion} onDoubleTap={onCompanionDoubleTap} />
        </View>

        <View style={styles.chips}>
          {CHIPS.map((c) => (
            <SuggestionChip key={c.label} icon={c.icon} label={c.label} onPress={() => openChat('greet', pickOpener(c.label, c.openers), go, c.entry)} />
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
