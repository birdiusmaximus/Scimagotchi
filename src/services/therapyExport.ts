/**
 * Therapy PDF export (brief §11.8). Produces a clear, NON-CLINICAL summary of the
 * user's own reflections to bring to therapy. Summaries only (no full transcripts
 * by default), generated locally: a real PDF via expo-print on native, or the
 * browser's print-to-PDF on web. Always carries the disclaimer.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { EMOTION_MAPS, FAMILY_COLORS } from '@/data/emotionMaps';
import { conversationsRepo, emotionEventsRepo, emotionProgressRepo } from '@/services/db/repos';
import type { EmotionFamilyId } from '@/types/models';
import { prettyDate } from '@/utils/date';

export type RangePreset = 'week' | 'month' | 'all';

export interface TherapyRange {
  start: Date;
  end: Date;
  label: string;
}

export interface TherapyExportData {
  rangeLabel: string;
  generatedAt: string;
  checkinCount: number;
  emotionSummary: { label: string; color: string; count: number; shades: string[]; stage?: string }[];
  keyPhrases: string[];
  events: { date: string; label: string; color: string; shade: string | null; trigger: string | null }[];
  repeatedTriggers: { text: string; count: number }[];
  feltShapes: string[];
  companionLearned: string[];
}

const DISCLAIMER =
  'This summary is generated from your self-reflections. It is not a clinical interpretation, diagnosis or treatment recommendation.';

const STAGE_LABEL: Record<string, string> = {
  unseen: 'Not yet explored',
  noticed: 'Noticed',
  named: 'Named',
  shaped: 'Shaped',
  understood: 'First shape understood',
  first_shape: 'First shape understood',
  rooted: 'Connected to its context',
  distinguished: 'Distinguished from nearby feelings',
  returning: 'A returning, familiar shape',
  deepened: 'Deepened pattern',
};

function fmtRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${start.toLocaleDateString([], opts)} – ${end.toLocaleDateString([], opts)}`;
}

export function rangeFromPreset(preset: RangePreset): TherapyRange {
  const end = new Date();
  const start = new Date(end);
  if (preset === 'week') {
    start.setDate(start.getDate() - 7);
    return { start, end, label: 'Last 7 days' };
  }
  if (preset === 'month') {
    start.setDate(start.getDate() - 30);
    return { start, end, label: 'Last 30 days' };
  }
  start.setFullYear(2000, 0, 1);
  return { start, end, label: 'All time' };
}

export async function buildExportData(range: TherapyRange): Promise<TherapyExportData> {
  const inRange = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= range.start.getTime() && t <= range.end.getTime();
  };

  const [allEvents, allConvos, progress] = await Promise.all([
    emotionEventsRepo.all().catch(() => []),
    conversationsRepo.all().catch(() => []),
    emotionProgressRepo.all().catch(() => []),
  ]);

  const events = allEvents
    .filter((e) => !e.do_not_store && e.emotion_family && inRange(e.timestamp))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const checkinCount = allConvos.filter((c) => inRange(c.created_at)).length;

  // Per-family summary
  const byFamily = new Map<EmotionFamilyId, { count: number; shades: Set<string> }>();
  for (const e of events) {
    const f = e.emotion_family as EmotionFamilyId;
    const entry = byFamily.get(f) ?? { count: 0, shades: new Set<string>() };
    entry.count += 1;
    if (e.emotion_shade) entry.shades.add(e.emotion_shade);
    byFamily.set(f, entry);
  }
  const emotionSummary = [...byFamily.entries()].map(([f, v]) => ({
    label: EMOTION_MAPS[f].label,
    color: FAMILY_COLORS[f],
    count: v.count,
    shades: [...v.shades],
    stage: progress.find((p) => p.emotion_family === f)?.current_stage,
  }));

  const keyPhrases = [...new Set(events.map((e) => e.user_words_raw).filter(Boolean))];

  const eventRows = events.map((e) => ({
    date: prettyDate(e.timestamp),
    label: EMOTION_MAPS[e.emotion_family as EmotionFamilyId].label,
    color: FAMILY_COLORS[e.emotion_family as EmotionFamilyId],
    shade: e.emotion_shade,
    trigger: e.trigger_event,
  }));

  const triggerCounts = new Map<string, number>();
  events.forEach((e) => {
    if (e.trigger_event) triggerCounts.set(e.trigger_event, (triggerCounts.get(e.trigger_event) ?? 0) + 1);
  });
  const repeatedTriggers = [...triggerCounts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count);

  const feltShapes = [...new Set(events.flatMap((e) => e.body_cue))];

  const learned = new Set<string>();
  events.forEach((e) => e.memory_note && learned.add(e.memory_note));
  progress
    .filter((p) => byFamily.has(p.emotion_family) && p.memory_summary)
    .forEach((p) => learned.add(p.memory_summary as string));

  return {
    rangeLabel: fmtRange(range.start, range.end),
    generatedAt: new Date().toLocaleString(),
    checkinCount,
    emotionSummary,
    keyPhrases,
    events: eventRows,
    repeatedTriggers,
    feltShapes,
    companionLearned: [...learned],
  };
}

const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function section(title: string, body: string): string {
  return `<section><h2>${esc(title)}</h2>${body}</section>`;
}

function list(items: string[]): string {
  if (!items.length) return `<p class="muted">None recorded in this period.</p>`;
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

export function buildHtml(d: TherapyExportData): string {
  const emotions = d.emotionSummary.length
    ? `<div class="chips">${d.emotionSummary
        .map(
          (e) =>
            `<span class="chip"><span class="dot" style="background:${e.color}"></span>${esc(e.label)} · ${e.count}${
              e.stage ? ` · ${esc(STAGE_LABEL[e.stage] ?? e.stage)}` : ''
            }${e.shades.length ? `<br><span class="muted small">${esc(e.shades.join(', '))}</span>` : ''}</span>`,
        )
        .join('')}</div>`
    : `<p class="muted">No emotions recorded in this period.</p>`;

  const eventsTable = d.events.length
    ? `<table><thead><tr><th>When</th><th>Emotion</th><th>Shade</th><th>What happened</th></tr></thead><tbody>${d.events
        .map(
          (e) =>
            `<tr><td class="muted small">${esc(e.date)}</td><td><span class="dot" style="background:${e.color}"></span>${esc(
              e.label,
            )}</td><td>${esc(e.shade ?? '—')}</td><td>${esc(e.trigger ?? '—')}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : `<p class="muted">No emotion events in this period.</p>`;

  const triggers = d.repeatedTriggers.length
    ? `<ul>${d.repeatedTriggers
        .map((t) => `<li>${esc(t.text)}${t.count > 1 ? ` <span class="muted small">(×${t.count})</span>` : ''}</li>`)
        .join('')}</ul>`
    : `<p class="muted">None recorded in this period.</p>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #2b2a4a; margin: 0; padding: 40px; line-height: 1.5; }
  header { border-bottom: 2px solid #ece9ff; padding-bottom: 16px; margin-bottom: 8px; }
  h1 { font-size: 24px; margin: 0 0 4px; color: #3c3a6b; }
  .sub { color: #6e6c9b; font-size: 13px; }
  .disclaimer { background: #f4f5fb; border: 1px solid #e3e1f5; border-radius: 10px; padding: 12px 14px; color: #5a5b80; font-size: 12px; margin: 18px 0 8px; }
  section { margin-top: 22px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #7c8cf8; margin: 0 0 8px; }
  ul { margin: 0; padding-left: 18px; }
  li { margin: 3px 0; }
  .muted { color: #8a8aa8; }
  .small { font-size: 12px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { border: 1px solid #e3e1f5; border-radius: 10px; padding: 8px 12px; font-size: 13px; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: #8a8aa8; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #ece9ff; padding: 6px 8px; }
  td { padding: 7px 8px; border-bottom: 1px solid #f3f2fb; vertical-align: top; }
  footer { margin-top: 28px; color: #a0a0bb; font-size: 11px; }
</style></head>
<body>
  <header>
    <h1>My reflections</h1>
    <div class="sub">Prepared with Scimagotchi · ${esc(d.rangeLabel)} · ${esc(d.checkinCount)} check-in${
      d.checkinCount === 1 ? '' : 's'
    }</div>
  </header>
  <div class="disclaimer">${esc(DISCLAIMER)}</div>
  ${section('Emotion summary', emotions)}
  ${section('Key phrases in my words', list(d.keyPhrases))}
  ${section('Emotion events', eventsTable)}
  ${section('Repeated triggers & contexts', triggers)}
  ${section('Felt shapes & body cues', list(d.feltShapes))}
  ${section('What the companion learned', list(d.companionLearned))}
  <footer>Generated ${esc(d.generatedAt)}. Stored on your device.</footer>
</body></html>`;
}

export async function exportTherapy(range: TherapyRange): Promise<{ ok: boolean; error?: string }> {
  try {
    const data = await buildExportData(range);
    const html = buildHtml(data);

    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'My reflections' });
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
