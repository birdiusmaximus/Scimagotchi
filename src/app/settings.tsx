import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/GradientBackground';
import { Glass } from '@/components/Glass';
import { IconButton } from '@/components/IconButton';
import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { useStore } from '@/state/store';
import { fontFamily, palette, radii, spacing } from '@/theme/tokens';

function SectionLabel({ children }: { children: string }) {
  return (
    <Txt variant="small" color={palette.inkSoft} style={styles.sectionLabel}>
      {children.toUpperCase()}
    </Txt>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const userName = useStore((s) => s.userName);
  const remindersEnabled = useStore((s) => s.remindersEnabled);

  const [name, setName] = useState(userName);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const saveName = () => useStore.getState().setUserName(name);

  const doDelete = async () => {
    await useStore.getState().resetAllData();
    setName('');
    setConfirmDelete(false);
    setDeleted(true);
  };

  return (
    <View style={styles.root}>
      <GradientBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.bar}>
          <IconButton name="chevron-left" onPress={() => router.back()} />
          <Txt variant="subtitle">Settings</Txt>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Name */}
          <SectionLabel>Your name</SectionLabel>
          <Glass radius={radii.lg} contentStyle={styles.cardPad}>
            <TextInput
              value={name}
              onChangeText={setName}
              onEndEditing={saveName}
              onSubmitEditing={saveName}
              placeholder="What should the companion call you?"
              placeholderTextColor={palette.inkSoft}
              style={styles.input}
              returnKeyType="done"
            />
          </Glass>

          {/* Reminders */}
          <SectionLabel>Reminders</SectionLabel>
          <Glass radius={radii.lg} contentStyle={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Txt variant="label" color={palette.inkOnGlass}>
                Gentle reminders
              </Txt>
              <Txt variant="small" color={palette.inkSoft}>
                Only after a quiet stretch — never a streak or a nudge to feel guilty.
              </Txt>
            </View>
            <Switch
              value={remindersEnabled}
              onValueChange={(v) => useStore.getState().setReminders(v)}
              trackColor={{ false: 'rgba(120,120,150,0.3)', true: palette.accent }}
              thumbColor={palette.white}
            />
          </Glass>

          {/* Privacy */}
          <SectionLabel>Privacy</SectionLabel>
          <Glass radius={radii.lg} contentStyle={styles.cardPad}>
            <Txt variant="body" color={palette.inkOnGlass} style={styles.privacy}>
              Your reflections, conversations and records stay on your device. To shape each reply, the message you send
              may be processed securely; your saved history never leaves your device.
            </Txt>
            <Txt variant="small" color={palette.inkSoft} style={{ marginTop: spacing.sm }}>
              Deleting the app deletes all of this data.
            </Txt>
          </Glass>

          {/* Export */}
          <SectionLabel>Therapy</SectionLabel>
          <PressableScale onPress={() => router.push('/export')} scaleTo={0.97}>
            <Glass radius={radii.lg} contentStyle={styles.rowBetween}>
              <View style={styles.rowLeft}>
                <Feather name="file-text" size={18} color={palette.accentDeep} />
                <Txt variant="label" color={palette.inkOnGlass}>
                  Export therapy notes (PDF)
                </Txt>
              </View>
              <Feather name="chevron-right" size={20} color={palette.inkSoft} />
            </Glass>
          </PressableScale>

          {/* Delete */}
          <SectionLabel>Data</SectionLabel>
          {confirmDelete ? (
            <Glass radius={radii.lg} contentStyle={styles.cardPad}>
              <Txt variant="label" color={palette.ink}>
                Delete everything?
              </Txt>
              <Txt variant="small" color={palette.inkSoft} style={{ marginTop: 4 }}>
                This permanently removes all your conversations, records and summaries. It can’t be undone.
              </Txt>
              <View style={styles.confirmRow}>
                <PressableScale onPress={() => setConfirmDelete(false)} style={[styles.btn, styles.btnGhost]}>
                  <Txt variant="label" color={palette.inkOnGlass}>
                    Cancel
                  </Txt>
                </PressableScale>
                <PressableScale onPress={doDelete} style={[styles.btn, styles.btnDanger]}>
                  <Txt variant="label" color={palette.white}>
                    Delete everything
                  </Txt>
                </PressableScale>
              </View>
            </Glass>
          ) : (
            <PressableScale
              scaleTo={0.97}
              onPress={() => {
                setDeleted(false);
                setConfirmDelete(true);
              }}
            >
              <Glass radius={radii.lg} contentStyle={styles.rowLeft}>
                <Feather name="trash-2" size={18} color={DANGER} />
                <Txt variant="label" color={DANGER}>
                  Delete all my data
                </Txt>
              </Glass>
            </PressableScale>
          )}

          {deleted ? (
            <Txt variant="small" color={palette.inkSoft} align="center" style={{ marginTop: spacing.md }}>
              All your local data has been deleted.
            </Txt>
          ) : null}

          <Txt variant="small" color={palette.inkSoft} align="center" style={styles.footer}>
            Scimagotchi · a reflection companion, not therapy. Adults 18+.
          </Txt>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const DANGER = '#C0506B';

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  bar: { paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scroll: { paddingTop: spacing.md, paddingBottom: spacing.xxl },
  sectionLabel: { letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.xs, marginLeft: spacing.xs },
  cardPad: { padding: spacing.md },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 14, paddingHorizontal: spacing.md },
  input: {
    fontFamily,
    fontSize: 16,
    color: palette.ink,
    paddingVertical: 8,
    outlineStyle: 'none', // web-only: remove focus ring
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  privacy: { lineHeight: 22 },
  confirmRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radii.pill },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.6)' },
  btnDanger: { backgroundColor: DANGER },
  footer: { marginTop: spacing.xxl, opacity: 0.85 },
});
