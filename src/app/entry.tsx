import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/GradientBackground';
import { Glass } from '@/components/Glass';
import { IconButton } from '@/components/IconButton';
import { MessageBubble } from '@/components/MessageBubble';
import { Txt } from '@/components/Txt';
import { EMOTION_MAPS, FAMILY_COLORS } from '@/data/emotionMaps';
import { emotionEventsRepo, messagesRepo } from '@/services/db/repos';
import { palette, radii, spacing } from '@/theme/tokens';
import type { EmotionEvent, Message, UnlockStage } from '@/types/models';
import { prettyDate } from '@/utils/date';

const STAGE_LABEL: Record<UnlockStage, string> = {
  noticed: 'Noticed',
  named: 'Named',
  shaped: 'Shaped',
  understood: 'First shape',
  deepened: 'Deepened',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Txt variant="small" color={palette.inkSoft}>
        {label}
      </Txt>
      <Txt variant="body" color={palette.inkOnGlass}>
        {value}
      </Txt>
    </View>
  );
}

export default function EntryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EmotionEvent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const ev = await emotionEventsRepo.get(id).catch(() => null);
      if (!active) return;
      setEvent(ev);
      if (ev) {
        const msgs = await messagesRepo.listByConversation(ev.conversation_id).catch(() => []);
        if (active) setMessages(msgs);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const map = event?.emotion_family ? EMOTION_MAPS[event.emotion_family] : null;
  const color = event?.emotion_family ? FAMILY_COLORS[event.emotion_family] : palette.inkSoft;

  return (
    <View style={styles.root}>
      <GradientBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.bar}>
          <IconButton name="chevron-left" onPress={() => router.back()} />
          <Txt variant="subtitle">Entry</Txt>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {!event ? (
            <Txt variant="body" color={palette.inkSoft} align="center" style={{ marginTop: spacing.xxl }}>
              This entry could not be found.
            </Txt>
          ) : (
            <>
              <Glass radius={radii.lg} contentStyle={styles.card}>
                <View style={styles.headerRow}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Txt variant="label" color={palette.inkOnGlass} style={{ flex: 1 }}>
                    {map ? map.label : 'Reflection'}
                  </Txt>
                  <View style={styles.badge}>
                    <Txt variant="small" color={palette.accentDeep}>
                      {STAGE_LABEL[event.unlock_stage]}
                    </Txt>
                  </View>
                </View>
                <Txt variant="small" color={palette.inkSoft} style={{ marginBottom: spacing.xs }}>
                  {prettyDate(event.timestamp)}
                </Txt>

                {event.emotion_shade ? <Field label="Shade" value={event.emotion_shade} /> : null}
                {event.user_words_raw ? <Field label="Your words" value={`“${event.user_words_raw}”`} /> : null}
                {event.body_cue.length ? <Field label="Felt shape" value={event.body_cue.join(', ')} /> : null}
                {event.trigger_event ? <Field label="What happened" value={event.trigger_event} /> : null}
                {event.appraisal_thought ? (
                  <Field label="What it seemed to mean" value={event.appraisal_thought} />
                ) : null}

                {event.memory_note ? (
                  <View style={styles.note}>
                    <Txt variant="small" color={palette.inkSoft}>
                      What the companion learned
                    </Txt>
                    <Txt variant="body" color={palette.inkOnGlass}>
                      {event.memory_note}
                    </Txt>
                  </View>
                ) : null}
              </Glass>

              {messages.length ? (
                <View style={styles.convo}>
                  <Txt variant="label" color={palette.inkSoft} style={styles.convoTitle}>
                    Conversation
                  </Txt>
                  {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  bar: { paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scroll: { paddingVertical: spacing.lg, gap: spacing.md },
  card: { padding: spacing.lg, gap: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  badge: {
    backgroundColor: 'rgba(124,140,248,0.18)',
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  field: { marginTop: spacing.sm, gap: 2 },
  note: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
  },
  convo: { gap: 2 },
  convoTitle: { marginBottom: spacing.xs },
});
