import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/GradientBackground';
import { Glass } from '@/components/Glass';
import { IconButton } from '@/components/IconButton';
import { useGoBack } from '@/hooks/useGoBack';
import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import {
  buildExportData,
  exportTherapy,
  rangeFromPreset,
  type RangePreset,
  type TherapyExportData,
} from '@/services/therapyExport';
import { gradients, palette, radii, spacing } from '@/theme/tokens';
import { LinearGradient } from 'expo-linear-gradient';

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'week', label: '7 days' },
  { key: 'month', label: '30 days' },
  { key: 'all', label: 'All time' },
];

export default function ExportScreen() {
  const goBack = useGoBack();
  const [preset, setPreset] = useState<RangePreset>('month');
  const [data, setData] = useState<TherapyExportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    buildExportData(rangeFromPreset(preset))
      .then((d) => active && setData(d))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [preset]);

  const onCreate = async () => {
    setBusy(true);
    setNote(null);
    const res = await exportTherapy(rangeFromPreset(preset));
    setBusy(false);
    setNote(res.ok ? 'Your summary is ready to save or share.' : 'Could not create the summary. Please try again.');
  };

  const empty = data && data.events.length === 0;

  return (
    <View style={styles.root}>
      <GradientBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.bar}>
          <IconButton name="chevron-left" onPress={goBack} />
          <Txt variant="subtitle">Therapy notes</Txt>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Txt variant="body" color={palette.inkSoft} style={styles.intro}>
            A clear, non-clinical summary of your own reflections — to bring to therapy, or keep for yourself.
          </Txt>

          <View style={styles.segment}>
            {PRESETS.map((p) => {
              const active = preset === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => setPreset(p.key)}
                  style={[styles.segItem, active && styles.segItemActive]}
                >
                  <Txt variant="label" color={active ? palette.white : palette.inkOnGlass}>
                    {p.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>

          <Glass radius={radii.lg} contentStyle={styles.card}>
            <Txt variant="small" color={palette.inkSoft}>
              {data?.rangeLabel ?? '…'}
            </Txt>
            <View style={styles.stats}>
              <Stat n={data?.events.length ?? 0} label="reflections" />
              <Stat n={data?.emotionSummary.length ?? 0} label="emotions" />
              <Stat n={data?.keyPhrases.length ?? 0} label="phrases" />
            </View>
            <Txt variant="small" color={palette.inkSoft} style={{ marginTop: spacing.sm }}>
              Includes: emotion summary · your key phrases · emotion events · repeated triggers · felt shapes · what the
              companion learned.
            </Txt>
          </Glass>

          <PressableScale onPress={onCreate} disabled={busy || !!empty} style={{ marginTop: spacing.lg }}>
            <LinearGradient
              colors={gradients.accentButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.create, (busy || empty) && { opacity: 0.6 }]}
            >
              {busy ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <>
                  <Feather name="file-text" size={18} color={palette.white} />
                  <Txt variant="label" color={palette.white}>
                    Create PDF
                  </Txt>
                </>
              )}
            </LinearGradient>
          </PressableScale>

          {empty ? (
            <Txt variant="small" color={palette.inkSoft} align="center" style={styles.note}>
              No reflections in this range yet — name a feeling with the companion first.
            </Txt>
          ) : note ? (
            <Txt variant="small" color={palette.inkSoft} align="center" style={styles.note}>
              {note}
            </Txt>
          ) : null}

          <Txt variant="small" color={palette.inkSoft} style={styles.disclaimer}>
            This summary is generated from your self-reflections. It is not a clinical interpretation, diagnosis or
            treatment recommendation.
          </Txt>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Txt variant="subtitle" align="center">
        {n}
      </Txt>
      <Txt variant="small" color={palette.inkSoft} align="center">
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  bar: { paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scroll: { paddingVertical: spacing.lg },
  intro: { marginBottom: spacing.lg, lineHeight: 22 },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: radii.pill,
    padding: 4,
    gap: 4,
    marginBottom: spacing.lg,
  },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radii.pill },
  segItemActive: { backgroundColor: palette.accent },
  card: { padding: spacing.lg, gap: 4 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm },
  stat: { alignItems: 'center', minWidth: 72 },
  create: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radii.pill,
  },
  note: { marginTop: spacing.md },
  disclaimer: { marginTop: spacing.xl, lineHeight: 18, opacity: 0.9 },
});
