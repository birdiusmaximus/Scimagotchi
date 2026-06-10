import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalendarView } from '@/components/CalendarView';
import { GradientBackground } from '@/components/GradientBackground';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { useGoBack } from '@/hooks/useGoBack';
import { EMOTION_MAPS, FAMILY_COLORS } from '@/data/emotionMaps';
import { emotionEventsRepo } from '@/services/db/repos';
import { palette, radii, spacing } from '@/theme/tokens';
import type { EmotionEvent } from '@/types/models';
import { dayKey, prettyTime } from '@/utils/date';
import { tintPair } from '@/utils/color';

export default function MemoryScreen() {
  const router = useRouter();
  const goBack = useGoBack();
  const todayKey = dayKey();
  const now = new Date();

  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(todayKey);
  const [byDay, setByDay] = useState<Record<string, EmotionEvent[]>>({});

  // Refresh whenever the screen comes into focus (new entries may have been saved).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      emotionEventsRepo
        .all()
        .then((all) => {
          if (!active) return;
          const grouped: Record<string, EmotionEvent[]> = {};
          for (const e of all) {
            if (e.do_not_store) continue;
            (grouped[dayKey(e.timestamp)] ??= []).push(e);
          }
          setByDay(grouped);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  const dayEntries = (byDay[selected] ?? []).slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const totalCount = Object.values(byDay).reduce((n, arr) => n + arr.length, 0);

  const prev = () =>
    setYm((s) => (s.month === 0 ? { year: s.year - 1, month: 11 } : { year: s.year, month: s.month - 1 }));
  const next = () =>
    setYm((s) => (s.month === 11 ? { year: s.year + 1, month: 0 } : { year: s.year, month: s.month + 1 }));

  return (
    <View style={styles.root}>
      <GradientBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.bar}>
          <IconButton name="chevron-left" onPress={goBack} />
          <Txt variant="subtitle">Memory</Txt>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <CalendarView
            year={ym.year}
            month={ym.month}
            eventsByDay={byDay}
            selected={selected}
            today={todayKey}
            onSelect={setSelected}
            onPrev={prev}
            onNext={next}
          />

          <View style={styles.entries}>
            {dayEntries.length === 0 ? (
              <Txt variant="body" color={palette.inkSoft} align="center" style={styles.empty}>
                {totalCount === 0
                  ? 'No entries yet. When you name a feeling with the companion, it will appear here.'
                  : 'Nothing recorded on this day.'}
              </Txt>
            ) : (
              dayEntries.map((ev) => {
                const map = ev.emotion_family ? EMOTION_MAPS[ev.emotion_family] : null;
                return (
                  <Pressable
                    key={ev.id}
                    onPress={() => router.push({ pathname: '/entry', params: { id: ev.id } })}
                    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
                  >
                    <View style={styles.entryCard}>
                      <LinearGradient
                        colors={tintPair(ev.emotion_family ? FAMILY_COLORS[ev.emotion_family] : palette.inkSoft)}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.entryTile}
                      >
                        <View style={styles.entryTileDot} />
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Txt variant="label" color={palette.ink}>
                          {map ? map.label : 'Reflection'}
                          {ev.emotion_shade ? ` · ${ev.emotion_shade}` : ''}
                        </Txt>
                        {ev.user_words_raw ? (
                          <Txt variant="small" color={palette.inkSoft} numberOfLines={1}>
                            “{ev.user_words_raw}”
                          </Txt>
                        ) : null}
                      </View>
                      <Txt variant="small" color={palette.inkSoft}>
                        {prettyTime(ev.timestamp)}
                      </Txt>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
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
  entries: { gap: spacing.sm },
  empty: { marginTop: spacing.lg },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingRight: spacing.md,
    paddingLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    boxShadow: '0px 8px 20px rgba(95,90,160,0.10)',
  },
  entryTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 10px rgba(95,90,160,0.18)',
  },
  entryTileDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.9)' },
});
