import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { Txt } from '@/components/Txt';
import { FAMILY_COLORS } from '@/data/emotionMaps';
import { gradients, palette, radii, spacing } from '@/theme/tokens';
import type { EmotionEvent } from '@/types/models';
import { monthLabel } from '@/utils/date';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type Props = {
  year: number;
  month: number; // 0-11
  eventsByDay: Record<string, EmotionEvent[]>;
  selected: string;
  today: string;
  onSelect: (dayKey: string) => void;
  onPrev: () => void;
  onNext: () => void;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** A month grid with emotion-coloured dots on days that hold records. */
export function CalendarView({ year, month, eventsByDay, selected, today, onSelect, onPrev, onNext }: Props) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Glass radius={radii.lg} contentStyle={styles.card}>
      <View style={styles.head}>
        <Pressable onPress={onPrev} hitSlop={10}>
          <Feather name="chevron-left" size={20} color={palette.inkOnGlass} />
        </Pressable>
        <Txt variant="label" color={palette.inkOnGlass}>
          {monthLabel(year, month)}
        </Txt>
        <Pressable onPress={onNext} hitSlop={10}>
          <Feather name="chevron-right" size={20} color={palette.inkOnGlass} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Txt key={i} variant="small" color={palette.inkSoft} align="center" style={styles.weekCell}>
            {w}
          </Txt>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={i} style={styles.cell} />;
          const key = `${year}-${pad2(month + 1)}-${pad2(d)}`;
          const entries = eventsByDay[key] ?? [];
          const isSel = key === selected;
          const isToday = key === today;
          const colors = [
            ...new Set(entries.map((e) => e.emotion_family).filter(Boolean) as string[]),
          ]
            .slice(0, 3)
            .map((f) => FAMILY_COLORS[f as keyof typeof FAMILY_COLORS]);

          return (
            <Pressable key={i} style={styles.cell} onPress={() => onSelect(key)}>
              {isSel ? (
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dayWrap}>
                  <Txt variant="label" color={palette.white}>
                    {d}
                  </Txt>
                </LinearGradient>
              ) : (
                <View style={styles.dayWrap}>
                  <Txt variant="label" color={isToday ? palette.accentDeep : palette.inkOnGlass}>
                    {d}
                  </Txt>
                </View>
              )}
              <View style={styles.dots}>
                {colors.map((c, ci) => (
                  <View key={ci} style={[styles.dot, { backgroundColor: c }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekCell: { width: '14.28%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 4, minHeight: 44 },
  dayWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dots: { flexDirection: 'row', gap: 3, height: 7, marginTop: 2, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
