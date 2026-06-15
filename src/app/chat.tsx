import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatChips } from '@/components/ChatChips';
import { ChatInput } from '@/components/ChatInput';
import { CompanionOrb } from '@/components/CompanionOrb';
import { EmotionUnlockCard } from '@/components/EmotionUnlockCard';
import { Glass } from '@/components/Glass';
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
import { gradients, palette, radii, spacing } from '@/theme/tokens';

/**
 * Chat — "conversation mode". At rest the character sits large in the top third (the
 * focus). When the keyboard opens, the hero orb gracefully collapses and a small
 * companion avatar fades into the header, so the companion stays VISIBLE while the
 * discussion window + docked input take the freed room — instead of the big orb being
 * crushed and the view jumping. Inside the Capacitor shell the WebView is set to
 * resize:'none', so we lift content above the keyboard by its reported height; in a
 * plain browser the visual viewport shrinks and no manual lift is needed.
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
  const native = isCapacitorNative();

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
  // once the feeling is deepened. Per-conversation, so a familiar feeling also eases in
  // gently each time rather than snapping straight to full colour.
  const tintLevel = orbFamily ? tintLevelForStage(draftEvent?.unlock_stage) : 0;

  // Continuation chips (engine brief §7.3, §16.2): offered sparingly — only when
  // the companion reflected WITHOUT asking a question, and nothing else is open.
  // Tapping one is a lightweight intent (stay with it / not quite / done), not a
  // canned message — it asks the companion engine for the right next turn.
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

  const scrollRef = useRef<ScrollView>(null);

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

  // The discussion window rises + fades in when the chat opens.
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withTiming(1, { duration: 540, easing: Easing.out(Easing.cubic) });
  }, [rise]);
  const windowStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: (1 - rise.value) * 72 }, { scale: 0.97 + rise.value * 0.03 }],
  }));

  // Conversation mode: when the keyboard opens, collapse the hero orb (top) and cross-
  // fade a compact companion avatar into the header, so the character stays present
  // without crushing the chat. Driven by one shared value so both move together.
  const kb = useSharedValue(0);
  useEffect(() => {
    kb.value = withTiming(keyboardOpen ? 1 : 0, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [keyboardOpen, kb]);
  // Scale the orb DOWN as its box collapses (rather than clipping it) — at every point
  // the scaled orb is smaller than its maxHeight box, so nothing overflows and there's no
  // hard clip rectangle cutting the orb's soft glow (which showed as lines mid-shift).
  const stageStyle = useAnimatedStyle(() => ({
    maxHeight: (1 - kb.value) * 240,
    opacity: 1 - kb.value,
    transform: [{ scale: 1 - kb.value }],
  }));
  const headerAvatarStyle = useAnimatedStyle(() => ({
    opacity: kb.value,
    transform: [{ scale: 0.7 + kb.value * 0.3 }, { translateX: (1 - kb.value) * -6 }],
  }));

  // Bottom spacing: at rest, clear the home indicator. Keyboard up on native — lift the
  // input by the keyboard's height (resize:'none', so we move it ourselves). Keyboard up
  // in a browser — 0, because the visual viewport already shrank to sit above the keys.
  const bottomPad = keyboardOpen ? (native ? keyboardHeight : 0) : insets.bottom;

  const isEmpty = messages.length === 0 && !sending;

  return (
    <View style={styles.root}>
      <GradientBackground families={tintFamilies} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <IconButton name="chevron-left" onPress={goBack} />
          {/* Compact companion — fades in while typing so the character never disappears. */}
          <Animated.View style={[styles.headerAvatar, headerAvatarStyle]} pointerEvents="none">
            <LinearGradient
              colors={gradients.orbCalm}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerAvatarGrad}
            >
              <View style={styles.miniEye} />
              <View style={styles.miniEye} />
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Character — the hero at rest, collapses when the keyboard is up */}
        <Animated.View style={[styles.stage, stageStyle]}>
          <CompanionOrb
            size={150}
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

        {/* Discussion window — grows to fill, input docked at its base */}
        <View style={[styles.windowWrap, { paddingBottom: bottomPad }]}>
          <Animated.View style={[styles.window, windowStyle]}>
            <Glass
              radius={radii.xl}
              fill={palette.glassFillSoft}
              style={styles.windowGlass}
              contentStyle={styles.windowContent}
            >
              {isEmpty ? (
                <View style={styles.empty}>
                  <Txt variant="body" color={palette.inkSoft} align="center">
                    I’m here. Tell me what’s on your mind.
                  </Txt>
                </View>
              ) : (
                <ScrollView
                  ref={scrollRef}
                  style={styles.flex}
                  contentContainerStyle={styles.messages}
                  onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                  showsVerticalScrollIndicator={false}
                >
                  {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                  {sending ? <TypingBubble /> : null}
                </ScrollView>
              )}

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

              <View style={styles.inputWrap}>
                <ChatInput
                  autoFocus
                  refocusSignal={speak.key}
                  onSubmit={(t) => {
                    setClosed(false);
                    useStore.getState().send(t);
                  }}
                />
              </View>
            </Glass>
          </Animated.View>
        </View>
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
  flex: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  header: { paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerAvatar: { width: 40, height: 40 },
  headerAvatarGrad: {
    flex: 1,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  miniEye: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  // Hero area at rest; its height animates to 0 as the keyboard opens. No overflow:hidden
  // — the orb scales with the box (see stageStyle), so there's nothing to clip.
  stage: { alignItems: 'center', justifyContent: 'center' },
  windowWrap: { flex: 1, paddingTop: spacing.xs },
  window: { flex: 1 },
  windowGlass: { flex: 1 },
  windowContent: { flex: 1, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  messages: { paddingTop: spacing.sm, paddingHorizontal: spacing.xs, gap: 2, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  inputWrap: { paddingTop: spacing.xs, paddingBottom: spacing.xs },
});
