/**
 * OpenAI implementation of a companion turn. One chat-completion call produces
 * both the natural in-character reply AND the structured emotion extraction
 * (json_schema). The app then decides the unlock stage deterministically
 * (stage.ts) — the model proposes, the product disposes.
 *
 * Native only: browsers can't call OpenAI directly (CORS), so the router in
 * aiClient.ts uses the local engine on web.
 */

import { detectFamily, emptyEvent, type CompanionInput, type CompanionTurn } from '@/services/ai/companionEngine';
import { buildSystemPrompt, COMPANION_OUTPUT_SCHEMA } from '@/services/ai/prompts';
import { evaluateStage, stageRank } from '@/services/ai/stage';
import { EMOTION_MAPS } from '@/data/emotionMaps';
import type { EmotionFamilyId, UnlockStage } from '@/types/models';
import { nowIso } from '@/utils/date';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

type Parsed = {
  reply: string;
  emotion_family: EmotionFamilyId | null;
  emotion_shade: string | null;
  secondary_emotions: string[];
  body_cue: string[];
  behaviour_action: string[];
  trigger_event: string | null;
  appraisal_thought: string | null;
  need_value: string[];
  valence: 'negative' | 'neutral' | 'positive' | 'mixed';
  activation: 'low' | 'medium' | 'high';
  user_words_raw: string;
  memory_note: string | null;
  confidence: 'high' | 'medium' | 'low';
};

export async function openaiGenerateTurn(
  input: CompanionInput,
  opts: { proxyUrl?: string | null; apiKey?: string | null; model: string },
): Promise<CompanionTurn> {
  const prev = input.prevEvent;
  const family = prev?.emotion_family ?? detectFamily(input.userText);

  const system = buildSystemPrompt({
    family,
    knownEvent: prev,
    memory: input.memory ?? null,
    userName: input.userName ?? null,
  });

  const history = (input.history ?? [])
    .slice(-8)
    .map((m) => ({ role: m.role === 'companion' ? 'assistant' : 'user', content: m.content }));

  const body = {
    model: opts.model,
    messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: input.userText }],
    response_format: { type: 'json_schema', json_schema: COMPANION_OUTPUT_SCHEMA },
    // Omit temperature (newer models only allow the default) and leave headroom
    // for reasoning tokens under max_completion_tokens.
    max_completion_tokens: 1500,
  };

  // Prefer the local proxy (key stays server-side); else call OpenAI directly.
  const endpoint = opts.proxyUrl || ENDPOINT;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!opts.proxyUrl && opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;

  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });

  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI: empty response');
  const p = JSON.parse(content) as Parsed;

  // Merge the model's reading into a (re)built event. The model re-extracts from
  // the whole conversation each turn, so we take its fields as the current truth
  // while preserving the stable id/conversation.
  const ev = prev ? { ...prev } : emptyEvent(input.conversationId);
  ev.timestamp = nowIso();

  const fam = p.emotion_family;
  ev.emotion_family = fam;
  ev.emotion_shade = p.emotion_shade ?? ev.emotion_shade ?? null;
  ev.secondary_emotions = p.secondary_emotions ?? [];
  ev.body_cue = p.body_cue ?? [];
  ev.behaviour_action = p.behaviour_action ?? [];
  ev.trigger_event = p.trigger_event ?? ev.trigger_event ?? null;
  ev.appraisal_thought = p.appraisal_thought ?? ev.appraisal_thought ?? null;
  ev.need_value = p.need_value ?? [];
  ev.valence = p.valence ?? 'neutral';
  ev.activation = p.activation ?? 'medium';
  if (p.user_words_raw && p.user_words_raw.trim()) ev.user_words_raw = p.user_words_raw.trim();
  ev.memory_note = p.memory_note ?? ev.memory_note ?? null;
  ev.confidence_level = p.confidence ?? 'medium';
  ev.evidence_basis = Array.from(new Set([...(ev.evidence_basis ?? []), 'self_report']));

  const prevStage: UnlockStage = prev?.unlock_stage ?? 'noticed';
  const computed = fam ? evaluateStage(ev) : 'noticed';
  // Stage never goes backwards within a conversation.
  const stage: UnlockStage = stageRank(computed) >= stageRank(prevStage) ? computed : prevStage;
  ev.unlock_stage = stage;

  const understoodNow = stage === 'understood';
  const wasUnderstood = prevStage === 'understood' || prevStage === 'deepened';
  const unlocked = understoodNow && !wasUnderstood;

  ev.emotion_status = fam ? (understoodNow ? 'confirmed' : 'candidate') : 'unclear';
  if (understoodNow) ev.user_confirmation = 'partial';

  const tone = fam ? EMOTION_MAPS[fam].tone : 'calm';

  return { reply: p.reply, event: ev, unlocked, tone, stage };
}
