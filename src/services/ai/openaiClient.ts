/**
 * OpenAI implementation of a companion turn — one model call wrapped in the
 * deterministic pipeline of the engine brief (§5): mode routing and variety
 * signals are computed BEFORE the call and injected as the per-turn plan;
 * output is sanitised and provenance-mapped AFTER; the app (stage.ts) decides
 * unlock. The model proposes; the product disposes.
 *
 * Native/web: callers route through the local proxy (key stays server-side).
 */

import { detectFamily, emptyEvent, type CompanionInput, type CompanionTurn } from '@/services/ai/companionEngine';
import { mixedConfirmed, sanitizeStrands } from '@/services/ai/mixedEmotion';
import { routeMode } from '@/services/ai/modeRouter';
import { buildSystemPrompt, COMPANION_OUTPUT_SCHEMA } from '@/services/ai/prompts';
import { isDuplicateReply, varietyDirective, varietySignals, type ResponseShape } from '@/services/ai/responsePolicy';
import { evaluateStage, stageRank } from '@/services/ai/stage';
import { EMOTION_MAPS } from '@/data/emotionMaps';
import type { EmotionFamilyId, LabelSource, MixedRelation, UnlockStage } from '@/types/models';
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
  label_source: LabelSource | null;
  user_confirmed_label: boolean;
  rejected_shades: string[];
  mixed_relation: MixedRelation | null;
  strands: unknown;
  asked_question: boolean;
  response_shape: ResponseShape;
};

/** Reject replies with non-Latin script runs (the Devanagari splice bug, eval P0). */
function hasUnexpectedScript(reply: string): boolean {
  return /[ऀ-ॿ؀-ۿ一-鿿぀-ヿ가-힯Ѐ-ӿ]/.test(reply);
}

export async function openaiGenerateTurn(
  input: CompanionInput,
  opts: { proxyUrl?: string | null; apiKey?: string | null; model: string },
): Promise<CompanionTurn> {
  const prev = input.prevEvent;
  const family = prev?.emotion_family ?? detectFamily(input.userText);

  // ── Deterministic pre-stages: mode + variety + safety directives ───────────
  const mode = routeMode(input.userText, prev ?? null, input.entryHint ?? null);
  const companionReplies = (input.history ?? []).filter((m) => m.role === 'companion').map((m) => m.content);
  const variety = varietyDirective(varietySignals(companionReplies));

  const system = buildSystemPrompt({
    family,
    knownEvent: prev,
    memory: input.memory ?? null,
    userName: input.userName ?? null,
    turn: { modeDirective: mode.directive, varietyDirective: variety, safetyNote: input.safetyNote ?? null },
  });

  const history = (input.history ?? [])
    .slice(-8)
    .map((m) => ({ role: m.role === 'companion' ? 'assistant' : 'user', content: m.content }));

  const callOnce = async (extraSystem?: string): Promise<Parsed> => {
    const body = {
      model: opts.model,
      messages: [
        { role: 'system', content: extraSystem ? `${system}\n\n${extraSystem}` : system },
        ...history,
        { role: 'user', content: input.userText },
      ],
      response_format: { type: 'json_schema', json_schema: COMPANION_OUTPUT_SCHEMA },
      // Omit temperature (newer models only allow the default); leave headroom
      // for reasoning tokens under max_completion_tokens.
      max_completion_tokens: 1500,
    };
    const endpoint = opts.proxyUrl || ENDPOINT;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!opts.proxyUrl && opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI: empty response');
    return JSON.parse(content) as Parsed;
  };

  // ── Call, with one retry on corrupted or verbatim-repeated output ──────────
  let p = await callOnce();
  if (hasUnexpectedScript(p.reply) || isDuplicateReply(p.reply, companionReplies)) {
    const reason = hasUnexpectedScript(p.reply)
      ? 'Your previous draft contained corrupted/mixed-script text.'
      : 'Your previous draft repeated an earlier reply verbatim.';
    try {
      p = await callOnce(`OUTPUT CORRECTION: ${reason} Compose a fresh reply — clean English only, and say something genuinely new.`);
    } catch {
      // keep the first parse; sanitise below
    }
    if (hasUnexpectedScript(p.reply)) {
      // Last resort: strip the corrupted runs rather than show them.
      p.reply = p.reply.replace(/[ऀ-ॿ؀-ۿ一-鿿぀-ヿ가-힯Ѐ-ӿ]+\??/g, '').replace(/\s{2,}/g, ' ').trim();
    }
  }

  // ── Merge the model's reading into the (re)built event ─────────────────────
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

  // Provenance (brief §8.1): hypotheses can never count as the user's truth.
  ev.label_source = p.label_source ?? 'companion_hypothesis';
  ev.mixed_relation = p.mixed_relation ?? null;
  const rejected = new Set([...(ev.user_rejected_shades ?? []), ...(p.rejected_shades ?? [])].map((s) => s.trim()).filter(Boolean));
  ev.user_rejected_shades = [...rejected];
  if (p.user_confirmed_label) ev.user_confirmation = 'yes';

  // Mixed-emotion engine (brief §9): strands may be proposed freely; the mixed
  // structure is CONFIRMED (savable) only per the §9.3 rules.
  ev.strands = sanitizeStrands(p.strands);
  ev.mixed_confirmed = mixedConfirmed(ev, prev ?? null) ? 1 : 0;

  // ── Deterministic staging with the First-Shape confirmation gate ───────────
  const prevStage: UnlockStage = prev?.unlock_stage ?? 'noticed';
  const computed = fam ? evaluateStage(ev, prev ?? null) : 'noticed';
  // Stage never goes backwards within a conversation.
  let stage: UnlockStage = stageRank(computed) >= stageRank(prevStage) ? computed : prevStage;

  // No progression at safety-sensitive moments (brief §13.4): the turn right
  // after a gentle safety check must never be the unlock moment.
  if (input.safetyNote && stage === 'understood' && prevStage !== 'understood' && prevStage !== 'deepened') {
    stage = prevStage;
  }
  ev.unlock_stage = stage;

  const understoodNow = stage === 'understood';
  const wasUnderstood = prevStage === 'understood' || prevStage === 'deepened';
  const unlocked = understoodNow && !wasUnderstood;

  ev.emotion_status = fam ? (understoodNow ? 'confirmed' : 'candidate') : 'unclear';
  if (understoodNow && ev.user_confirmation === 'unknown') ev.user_confirmation = 'partial';

  const tone = fam ? EMOTION_MAPS[fam].tone : 'calm';

  return { reply: p.reply, event: ev, unlocked, tone, stage };
}
