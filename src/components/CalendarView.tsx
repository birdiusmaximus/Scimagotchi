import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { FAMILY_COLORS } from '@/data/emotionMaps';
import { gradients, palette, radii, spacing } from '@/theme/tokens';
import type { EmotionEvent } from '@/types/models';
import { withAlpha } from '@/utils/color';
import { monthLabel } from '@/utils/date';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * A day's fill is built from the feelings it actually held: one colour becomes a
 * two-stop tint of itself, several become a blend across them. `alpha` sets the
 * strength (vivid for the selected day, soft for other days with records).
 */
function dayGradient(colors: string[], alpha: number): readonly [string, string, ...string[]] {
  if (colors.length === 1) return [withAlpha(colors[0], alpha), withAlpha(colors[0], alpha * 0.62)];
  const stops = colors.map((c) => withAlpha(c, alpha));
  return [stops[0], stops[1], ...stops.slice(2)] as [string, string, ...string[]];
}

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
        <PressableScale onPress={onPrev} hitSlop={10}>
          <Feather name="chevron-left" size={20} color={palette.inkOnGlass} />
        </PressableScale>
        <Txt variant="label" color={palette.inkOnGlass}>
          {monthLabel(year, month)}
        </Txt>
        <PressableScale onPress={onNext} hitSlop={10}>
          <Feather name="chevron-right" size={20} color={palette.inkOnGlass} />
        </PressableScale>
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

          const hasEvents = colors.length > 0;

          return (
            <PressableScale key={i} style={styles.cell} onPress={() => onSelect(key)}>
              {isSel ? (
                // Selected: a vivid blend of the day's feelings (brand as fallback when empty).
                <LinearGradient
                  colors={hasEvents ? dayGradient(colors, 0.95) : gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.dayWrap}
                >
                  <Txt variant="label" color={palette.white}>
                    {d}
                  </Txt>
                </LinearGradient>
              ) : hasEvents ? (
                // Other days with records: a soft tint of that day's colours.
                <LinearGradient
                  colors={dayGradient(colors, 0.34)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.dayWrap, isToday && styles.todayRing]}
                >
                  <Txt variant="label" color={isToday ? palette.accentDeep : palette.inkOnGlass}>
                    {d}
                  </Txt>
                </LinearGradient>
              ) : (
                <View style={[styles.dayWrap, isToday && styles.todayRing]}>
                  <Txt variant="label" color={isToday ? palette.accentDeep : palette.inkOnGlass}>
                    {d}
                  </Txt>
                </View>
              )}
            </PressableScale>
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
  cell: { width: '14.28%', alignItems: 'center', justifyContent: 'center', paddingVertical: 5, minHeight: 42 },
  dayWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  todayRing: { borderWidth: 1.5, borderColor: palette.accentDeep },
});
