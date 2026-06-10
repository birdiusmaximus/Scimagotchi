import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatInput } from '@/components/ChatInput';
import { CompanionOrb } from '@/components/CompanionOrb';
import { EmotionUnlockCard } from '@/components/EmotionUnlockCard';
import { Glass } from '@/components/Glass';
import { GradientBackground } from '@/components/GradientBackground';
import { IconButton } from '@/components/IconButton';
import { MemoryDraftCard } from '@/components/MemoryDraftCard';
import { MessageBubble } from '@/components/MessageBubble';
import { TypingBubble } from '@/components/TypingBubble';
import { Txt } from '@/components/Txt';
import { selectVisualState, visualTintFamilies } from '@/services/ai/companionVisualState';
import { useStore } from '@/state/store';
import { palette, radii, spacing } from '@/theme/tokens';

/**
 * Chat — the character sits large in the top third (the focus), and the
 * conversation lives in a dedicated glass "discussion window" that fills the
 * lower two-thirds. The window animates up on mount, and clips its messages at
 * its rounded edge so they read as contained — not floating in thin air.
 */
export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cid?: string }>();
  const cid = typeof params.cid === 'string' ? params.cid : null;

  const messages = useStore((s) => s.messages);
  const orbFamily = useStore((s) => s.orbFamily);
  const sending = useStore((s) => s.sending);
  const unlock = useStore((s) => s.unlock);
  const conversationId = useStore((s) => s.conversationId);
  const memoryDraft = useStore((s) => s.memoryDraft);
  const draftEvent = useStore((s) => s.draftEvent);
  const safetyVisible = useStore((s) => s.safety.visible);
  const safetyCheck = useStore((s) => s.safetyCheck);
  const progress = useStore((s) => s.progress);

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

  const scrollRef = useRef<ScrollView>(null);

  // Re-attach the conversation from the URL if the store lost it (reload/refresh).
  useEffect(() => {
    if (cid && conversationId !== cid) useStore.getState().attachConversation(cid);
  }, [cid, conversationId]);

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

  const isEmpty = messages.length === 0 && !sending;

  return (
    <View style={styles.root}>
      <GradientBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <IconButton name="chevron-left" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>

        {/* Character — top third, the focus */}
        <View style={styles.stage}>
          <CompanionOrb size={150} interactive family={orbFamily} tintFamilies={tintFamilies} visual={visual} speak={speak} />
        </View>

        {/* Discussion window — lower two-thirds */}
        <KeyboardAvoidingView
          style={styles.windowWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
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

              {memoryDraft && !unlock ? (
                <MemoryDraftCard
                  draft={memoryDraft}
                  onSave={() => useStore.getState().confirmMemoryDraft()}
                  onEdit={(t) => useStore.getState().editMemoryDraft(t)}
                  onReject={() => useStore.getState().rejectMemoryDraft()}
                />
              ) : null}

              <View style={styles.inputWrap}>
                <ChatInput autoFocus refocusSignal={speak.key} onSubmit={(t) => useStore.getState().send(t)} />
              </View>
            </Glass>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {unlock ? (
        <EmotionUnlockCard
          event={unlock.event}
          onKeepExploring={() => useStore.getState().dismissUnlock()}
          onDone={() => {
            useStore.getState().dismissUnlock();
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
  header: { paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  windowWrap: { flex: 2, paddingBottom: spacing.md },
  window: { flex: 1 },
  windowGlass: { flex: 1 },
  windowContent: { flex: 1, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  messages: { paddingTop: spacing.sm, paddingHorizontal: spacing.xs, gap: 2, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  inputWrap: { paddingTop: spacing.xs, paddingBottom: spacing.xs },
});
