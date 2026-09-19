import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatChips } from '@/components/ChatChips';
import { ChatInput } from '@/components/ChatInput';
import { CompanionOrb } from '@/components/CompanionOrb';
import { EmotionUnlockCard } from '@/components/EmotionUnlockCard';
import { GradientBackground } from '@/components/GradientBackground';
import { IconButton } from '@/components/IconButton';
import { LearningReviewCard } from '@/components/LearningReviewCard';
import { MessageBubble } from '@/components/MessageBubble';
import { TypingBubble } from '@/components/TypingBubble';
import { Txt } from '@/components/Txt';
import { useGoBack } from '@/hooks/useGoBack';
import type { CompanionGesture } from '@/services/ai/companionPose';
import { selectVisualState, tintLevelForStage, visualTintFamilies } from '@/services/ai/companionVisualState';
import { isCapacitorNative } from '@/services/native/capacitor';
import { useStore } from '@/state/store';
import { palette, spacing } from '@/theme/tokens';

/**
 * Chat — "companion-first". The character is a full-bleed BACKDROP that stays large at
 * all times: when the keyboard opens it simply eases up to stay centred in the space
 * above the keys, instead of collapsing into a header avatar. There is no transcript —
 * the user's words live only in the input field and are never drawn as bubbles; only the
 * companion's latest reply floats over the backdrop, above the input. This dissolves the
 * keyboard-crush problem (nothing scrolls, so nothing competes with the orb for height)
 * and keeps the creature — the point of the app — front and centre. Memory is untouched:
 * every turn is still recorded in the store/SQLite; this only changes what is rendered.
 */
export default function ChatScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const params = useLocalSearchParams<{ cid?: string }>();
  const cid = typeof params.cid === 'string' ? params.cid : null;

  const messages = useStore((s) => s.messages);
  const orbFamily = useStore((s) => s.orbFamily);
  const sending = useStore((s) => s.sending);
  const unlock = useStore((s) => s.unlock);
  const conversationId = useStore((s) => s.conversationId);
  const draftEvent = useStore((s) => s.draftEvent);
  const safetyVisible = useStore((s) => s.safety.visible);
  const safetyCheck = useStore((s) => s.safetyCheck);
  const progress = useStore((s) => s.progress);
  const memoryCards = useStore((s) => s.memoryCards);
  const keyboardOpen = useStore((s) => s.keyboardOpen);
  const keyboardHeight = useStore((s) => s.keyboardHeight);

  const insets = useSafeAreaInsets();
  // Any native runtime that must lift its own content above the keyboard: a real RN build
  // (iOS/Android via EAS) or the Capacitor WebView (resize:'none'). Plain mobile web doesn't —
  // its visual viewport shrinks instead, so the input already sits above the keyboard.
  const liftByKeyboard = Platform.OS !== 'web' || isCapacitorNative();

  // What the companion auto-learned in THIS conversation — shown as a gentle,
  // transparent session-end review (brief §7.2), not a save gate.
  const sessionLearned = memoryCards.filter(
    (c) =>
      c.source_conversation_id === conversationId &&
      c.muted !== 1 &&
      (c.confirmation_status === 'auto_learned' ||
        c.confirmation_status === 'user_confirmed' ||
        c.confirmation_status === 'user_edited'),
  );
  const [reviewing, setReviewing] = useState(false);

  // Companion visual state (engine brief §18) — derived, ambience only.
  const family = draftEvent?.emotion_family ?? null;
  const visual = selectVisualState({
    safetyVisible,
    safetyCheckPending: !!safetyCheck,
    sending,
    unlockShowing: !!unlock,
    draftEvent,
    progressStage: family ? (progress[family]?.current_stage ?? null) : null,
  });
  const tintFamilies = visualTintFamilies(draftEvent);
  // How fully the orb wears the feeling's colour — tied to THIS conversation's unlock
  // stage, so it starts as a faint shade when first noticed and only fills completely
  // once the feeling is deepened.
  const tintLevel = orbFamily ? tintLevelForStage(draftEvent?.unlock_stage) : 0;

  // Companion-first display: only the companion's latest line is ever shown. The user's
  // messages still enter the store (engine + memory) but are never rendered as bubbles.
  let reply = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'companion') {
      reply = messages[i];
      break;
    }
  }

  // Continuation chips (engine brief §7.3, §16.2): offered sparingly — only when
  // the companion reflected WITHOUT asking a question, and nothing else is open.
  const [chipsDismissedFor, setChipsDismissedFor] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const last = messages[messages.length - 1];
  const showChips =
    !!last &&
    last.role === 'companion' &&
    !last.content.includes('?') &&
    messages.some((m) => m.role === 'user') && // only after a real exchange, not the bare opener
    !sending &&
    !unlock &&
    !safetyVisible &&
    !safetyCheck &&
    !closed &&
    chipsDismissedFor !== last.id;

  // Re-attach the conversation from the URL if the store lost it (reload/refresh).
  useEffect(() => {
    if (cid && conversationId !== cid) useStore.getState().attachConversation(cid);
  }, [cid, conversationId]);

  // Transient orb gestures: a tapped chip (stay with it / not quite / done) or the
  // greeting on arrival. The arm orbs play the pose, then revert to the ambient one.
  const [orbGesture, setOrbGesture] = useState<{ key: number; state: CompanionGesture; hold?: boolean } | null>(null);
  const fireGesture = (state: CompanionGesture, hold?: boolean) =>
    setOrbGesture((g) => ({ key: (g?.key ?? 0) + 1, state, hold }));

  // Arrival: the companion plays an anticipation (arms swing wide, then settle).
  const [orbAnticipate, setOrbAnticipate] = useState<{ key: number } | null>(null);
  useEffect(() => {
    setOrbAnticipate({ key: 1 });
  }, []);
  // Double-tapping the companion makes it wave back.
  const [orbWave, setOrbWave] = useState<{ key: number } | null>(null);
  const waveBack = () => setOrbWave((w) => ({ key: (w?.key ?? 0) + 1 }));

  // Make the orb react once per sentence whenever a new companion reply lands.
  const [speak, setSpeak] = useState({ key: 0, sentences: 1 });
  const lastCompanion = useRef<string | null>(null);
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== 'companion') continue;
      const m = messages[i];
      if (m.id !== lastCompanion.current) {
        lastCompanion.current = m.id;
        const sentences = (m.content.match(/[.!?]+/g) ?? []).length || 1;
        setSpeak((s) => ({ key: s.key + 1, sentences: Math.min(4, Math.max(1, sentences)) }));
      }
      break;
    }
  }, [messages]);

  // The dock (reply + input) rises + fades in when the chat opens.
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withTiming(1, { duration: 540, easing: Easing.out(Easing.cubic) });
  }, [rise]);
  const dockStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: (1 - rise.value) * 48 }],
  }));

  // Keyboard: the orb NEVER collapses. It just eases up (and a touch smaller) so it stays
  // centred in the space above the keyboard. One shared value drives it.
  const kb = useSharedValue(0);
  useEffect(() => {
    kb.value = withTiming(keyboardOpen ? 1 : 0, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [keyboardOpen, kb]);
  const orbLayerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: kb.value * -78 }, { scale: 1 - kb.value * 0.12 }],
  }));

  // Bottom spacing: at rest, clear the home indicator. Keyboard up on native — lift the
  // dock by the keyboard's height (resize:'none', so we move it ourselves). Keyboard up
  // in a browser — 0, because the visual viewport already shrank to sit above the keys.
  const bottomPad = keyboardOpen ? (liftByKeyboard ? keyboardHeight : 0) : insets.bottom;

  return (
    <View style={styles.root}>
      <GradientBackground families={tintFamilies} />

      {/* Character — a full-bleed backdrop. It stays large; the keyboard only nudges it up. */}
      <Animated.View style={[styles.orbLayer, { top: insets.top + 60 }, orbLayerStyle]} pointerEvents="box-none">
        <CompanionOrb
          size={208}
          interactive
          family={orbFamily}
          tintFamilies={tintFamilies}
          tintLevel={tintLevel}
          visual={visual}
          speak={speak}
          gesture={orbGesture}
          wave={orbWave}
          anticipate={orbAnticipate}
          onDoubleTap={waveBack}
        />
      </Animated.View>

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} pointerEvents="box-none">
        <View style={styles.header}>
          <IconButton name="chevron-left" onPress={goBack} />
        </View>

        {/* Empty middle — taps fall through to the companion behind. */}
        <View style={styles.spacer} pointerEvents="box-none" />

        {/* The companion's current voice + the input, floating over the backdrop. */}
        <Animated.View style={[styles.dock, dockStyle, { paddingBottom: bottomPad }]} pointerEvents="box-none">
          <View style={styles.voiceRow} pointerEvents="box-none">
            {sending ? (
              <TypingBubble />
            ) : reply ? (
              <MessageBubble key={reply.id} message={reply} />
            ) : (
              <Txt variant="body" color={palette.inkSoft} style={styles.prompt}>
                I’m here. Tell me what’s on your mind.
              </Txt>
            )}
          </View>

          {showChips ? (
            <ChatChips
              onKeepGoing={() => {
                fireGesture('stayWithIt');
                useStore.getState().send('Let’s stay with it.', { intent: 'keep_going' });
              }}
              onNotQuite={() => {
                fireGesture('notQuite');
                useStore.getState().send('Hmm, not quite.', { intent: 'not_quite' });
              }}
              onDone={() => {
                setClosed(true);
                fireGesture('done');
                useStore.getState().send('I think I’ll leave it here.', { intent: 'done' });
              }}
            />
          ) : null}

          <View style={styles.inputWrap} pointerEvents="auto">
            <ChatInput
              autoFocus
              refocusSignal={speak.key}
              onSubmit={(t) => {
                setClosed(false);
                useStore.getState().send(t);
              }}
            />
          </View>
        </Animated.View>
      </SafeAreaView>

      {unlock ? (
        <EmotionUnlockCard
          event={unlock.event}
          kind={unlock.kind}
          onKeepExploring={() => useStore.getState().dismissUnlock()}
          onNotQuite={() => {
            // Correcting a first shape (§6.3): dismiss the ceremony and run the same
            // repair intent as the chip, so the reading is dropped and reopened gently.
            useStore.getState().dismissUnlock();
            setClosed(false);
            useStore.getState().send('Hmm, not quite.', { intent: 'not_quite' });
          }}
          onDone={() => {
            useStore.getState().dismissUnlock();
            // If the companion kept something this session, show it transparently
            // before leaving (§7.2); otherwise just go home.
            if (sessionLearned.length) setReviewing(true);
            else router.replace('/');
          }}
        />
      ) : null}

      {reviewing && !unlock ? (
        <LearningReviewCard
          cards={sessionLearned}
          onForget={(id) => useStore.getState().deleteMemoryCard(id)}
          onDone={() => {
            setReviewing(false);
            router.replace('/');
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  header: { paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  // Full-bleed backdrop layer; the orb is centred horizontally and anchored near the top.
  orbLayer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  spacer: { flex: 1 },
  dock: { paddingTop: spacing.xs },
  voiceRow: { paddingBottom: spacing.sm },
  prompt: { textAlign: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  inputWrap: { paddingTop: spacing.xs },
});
