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
import { isPositiveFamily } from '@/services/ai/companionPose';
import { mixedConfirmed, sanitizeStrands } from '@/services/ai/mixedEmotion';
import { intentDecision, routeMode, SAVOUR_RX } from '@/services/ai/modeRouter';
import { buildSystemPrompt, COMPANION_OUTPUT_SCHEMA } from '@/services/ai/prompts';
import {
  askedForNamingHelp,
  doorwayOf,
  dropTrailingQuestion,
  EXIT_CUE,
  isDuplicateReply,
  isOptionMenu,
  isTentativeReply,
  offersOffRamp,
  replaceOptionMenu,
  repeatsEarlierQuestion,
  repeatsRecentReflection,
  stripEchoedSentences,
  stripOffRamp,
  varietyDirective,
  varietySignals,
  type ResponseShape,
} from '@/services/ai/responsePolicy';
import { needsOwnershipRepair, softenUnownedEmotionReply } from '@/services/ai/replyOwnership';
import { hasUserOwnedConcreteDetail, userHasOriginated, reintroducesWord, intenseUserWord, INTENSE_FEELING, SOFTENING_CUE } from '@/services/ai/evidenceLedger';
import {
  detectShadeRejection,
  evaluateStage,
  isClarifyingQuestion,
  isUncertain,
  labelIsUserOwned,
  labelNamedByUser,
  shadeIsUserOwned,
  stageRank,
  userConfirmsLabel,
} from '@/services/ai/stage';
import { EMOTION_MAPS } from '@/data/emotionMaps';
import type { EmotionFamilyId, LabelSource, MixedRelation, UnlockStage } from '@/types/models';
import { nowIso } from '@/utils/date';
import { stripControlChars, stripEmDashes } from '@/utils/text';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// Figurative distress idioms must not be stored as literal BODY evidence (brief §2):
// "I can't breathe" in a stress context is a metaphor for overwhelm, not a felt body
// cue that defines the user's personal shape. The safety ladder handles genuine
// medical/risk meaning separately; here we only stop the idiom from counting as a
// feeling signal. A literal marker (in the cue OR the user's words) keeps the cue.
const FIGURATIVE_BODY = /\b(cant breathe|can'?t breathe|cannot breathe|couldnt breathe|could not breathe|drowning|crushed|crushing|suffocat\w*|buried|smothered|choking|sinking)\b/i;
const LITERAL_BODY_MARKER = /(right now|physically|literally|actually|chest pain|chest hurts|tight chest|ambulance|lips are blue|wheez|asthma|cant catch (my )?breath|gasping|passing out)/i;
function stripFigurativeBody(cues: string[], userText: string): string[] {
  const literalContext = LITERAL_BODY_MARKER.test(userText);
  return (cues ?? []).filter((c) => !(FIGURATIVE_BODY.test(c) && !LITERAL_BODY_MARKER.test(c) && !literalContext));
}

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
  // The user is expressing uncertainty this turn ("not sure", "i dont know"): the
  // companion gets more curious, never more confident — no unlock, and their unsure
  // words must not be stored as the feeling's phrase.
  const uncertainTurn = !input.intent && isUncertain(input.userText);
  // The user is asking the companion to explain/distinguish its own words ("what's the
  // difference between quiet and settled?") — a question to answer, not a feeling to bank.
  const clarifyingQuestion = !input.intent && isClarifyingQuestion(input.userText);

  // ── Deterministic pre-stages: mode + variety + safety directives ───────────
  // A tapped continuation chip drives the mode directly (reliable intent), instead
  // of hoping the text heuristics catch it.
  // Sticky savour: if a positive feeling is in play and the person already chose not
  // to dissect it earlier this conversation, keep protecting it (see routeMode).
  const savouredEarlier =
    !!prev?.emotion_family &&
    isPositiveFamily(prev.emotion_family) &&
    (input.history ?? []).some((m) => m.role === 'user' && SAVOUR_RX.test(m.content));
  const mode = input.intent
    ? intentDecision(input.intent, prev ?? null)
    : routeMode(input.userText, prev ?? null, input.entryHint ?? null, { savouredEarlier });
  const companionReplies = (input.history ?? []).filter((m) => m.role === 'companion').map((m) => m.content);
  const variety = varietyDirective(varietySignals(companionReplies));

  const system = buildSystemPrompt({
    family,
    knownEvent: prev,
    memory: input.memory ?? null,
    userName: input.userName ?? null,
    facets: input.activeFacets ?? null,
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

  // ── Call, with one retry on corrupted, verbatim-repeated, or re-asked output ──
  let p = await callOnce();
  const repeatedQ = repeatsEarlierQuestion(p.reply, companionReplies);
  // A "stay with it" tap that just restates the last reflection instead of opening a
  // new door (a real failure mode on taps, where there's no new user text to react to).
  const repeatedReflection = repeatsRecentReflection(p.reply, companionReplies);
  if (hasUnexpectedScript(p.reply) || isDuplicateReply(p.reply, companionReplies) || repeatedQ || repeatedReflection) {
    const reason = hasUnexpectedScript(p.reply)
      ? 'Your previous draft contained corrupted/mixed-script text. Compose a fresh reply in clean English only.'
      : repeatedQ
        ? 'Your previous draft asked a question they have ALREADY answered earlier in this conversation. Do NOT ask it again. Re-read what they have actually told you and respond to THAT specific thing — reflect it back a little more precisely, and only then, if it helps, open ONE genuinely new door (what it costs them, what it protects or needs, what it connects to, a finer shade). Reference their real words, not a generic prompt.'
        : repeatedReflection
          ? 'Your previous draft RESTATED the reflection you just gave them, in almost the same words. Do NOT repeat yourself. Move one concrete step further: open a genuinely new door from what they last said (the body, the impulse, what it protects, what it connects to, a finer shade), or reflect a NEW angle. Never echo your own last sentence back.'
          : 'Your previous draft repeated an earlier reply verbatim. Say something genuinely new.';
    try {
      p = await callOnce(`OUTPUT CORRECTION: ${reason}`);
    } catch {
      // keep the first parse; sanitise below
    }
    if (hasUnexpectedScript(p.reply)) {
      // Last resort: strip the corrupted runs rather than show them.
      p.reply = p.reply.replace(/[ऀ-ॿ؀-ۿ一-鿿぀-ヿ가-힯Ѐ-ӿ]+\??/g, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  // Deterministic backstop: if the reply STILL repeats an earlier question after the
  // retry (the model re-asked the same doorway, e.g. "Where do you notice it most?"
  // twice), drop the trailing question rather than ask it twice. The reflection stays.
  if (repeatsEarlierQuestion(p.reply, companionReplies)) {
    const stripped = dropTrailingQuestion(p.reply).trim();
    if (stripped) p.reply = stripped;
  }
  // And if it still echoes the previous reflection, drop the echoed sentence(s).
  if (repeatsRecentReflection(p.reply, companionReplies)) {
    p.reply = stripEchoedSentences(p.reply, companionReplies[companionReplies.length - 1] ?? '');
  }

  // ── Merge the model's reading into the (re)built event ─────────────────────
  const ev = prev ? { ...prev } : emptyEvent(input.conversationId);
  ev.timestamp = nowIso();

  // Family is the model's read, but a CONSOLIDATED family must not silently drop
  // on a later turn (capture fidelity §5.5); earlier stages may still go null.
  let fam = p.emotion_family;
  if (!fam && prev?.emotion_family && (prev.unlock_stage === 'understood' || prev.unlock_stage === 'deepened')) {
    fam = prev.emotion_family;
  }
  ev.emotion_shade = p.emotion_shade ?? ev.emotion_shade ?? null;
  // A shade is meaningless without a family (§5.5 invariant): inherit prev, else drop it.
  if (ev.emotion_shade && !fam) {
    fam = prev?.emotion_family ?? null;
    if (!fam) ev.emotion_shade = null;
  }
  ev.emotion_family = fam;
  ev.secondary_emotions = p.secondary_emotions ?? [];
  // Strip figurative distress idioms so they can't masquerade as literal body evidence (§2).
  ev.body_cue = stripFigurativeBody(p.body_cue ?? [], input.userText);
  ev.behaviour_action = p.behaviour_action ?? [];
  ev.trigger_event = p.trigger_event ?? ev.trigger_event ?? null;
  ev.appraisal_thought = p.appraisal_thought ?? ev.appraisal_thought ?? null;
  ev.need_value = p.need_value ?? [];
  ev.valence = p.valence ?? 'neutral';
  ev.activation = p.activation ?? 'medium';
  // On a tapped-chip turn there is no real new user phrase (the "text" is a button
  // label), an unsure turn ("not sure") is not the feeling's words, and a shallow hedge
  // ("yeah i guess", "i guess") is not either — keep the person's actual words from prev
  // rather than overwriting them with a non-answer (brief §8).
  if (!input.intent && !uncertainTurn && p.user_words_raw && p.user_words_raw.trim() && !isUncertain(p.user_words_raw)) {
    ev.user_words_raw = p.user_words_raw.trim();
  }
  const note = p.memory_note ?? ev.memory_note ?? null;
  ev.memory_note = note ? stripEmDashes(note) : null;
  ev.confidence_level = p.confidence ?? 'medium';
  ev.evidence_basis = Array.from(new Set([...(ev.evidence_basis ?? []), 'self_report']));

  // Provenance (brief §8.1): hypotheses can never count as the user's truth.
  ev.label_source = p.label_source ?? 'companion_hypothesis';
  ev.mixed_relation = p.mixed_relation ?? null;
  const rejected = new Set([...(ev.user_rejected_shades ?? []), ...(p.rejected_shades ?? [])].map((s) => s.trim()).filter(Boolean));
  // Pushback detector (§6.3): if they corrected the shade the companion had in play
  // ("no, not dread", "that doesn't fit"), record it as rejected so it cannot unlock.
  const pushedBack = detectShadeRejection(input.userText, prev ?? null);
  if (pushedBack) {
    rejected.add(pushedBack);
    if (ev.emotion_shade && ev.emotion_shade.toLowerCase() === pushedBack.toLowerCase()) ev.emotion_shade = null;
    ev.user_confirmation = 'no';
  }
  ev.user_rejected_shades = [...rejected];
  // Durable quarantine (review action 4): a shade the user has EVER rejected must not
  // come back as the companion's proposal on a later turn — only the user reintroducing
  // the word themselves lifts it. Clears it from the event so it can't ride along as the
  // shade/candidate, reach memory, or be reflected back as if newly proposed.
  if (ev.emotion_shade) {
    const sl = ev.emotion_shade.toLowerCase().trim();
    // Only the user genuinely RE-OWNING the word lifts the quarantine — the word appearing
    // inside its own rejection ("no, not empty") is pushing it away, not reintroducing it (#7).
    const reintroduced = reintroducesWord(sl, input.userText || '');
    if ([...rejected].some((r) => r.toLowerCase().trim() === sl) && !reintroduced) {
      ev.emotion_shade = null;
    }
  }
  if (p.user_confirmed_label) ev.user_confirmation = 'yes';

  // Ownership backstop: the user must name or accept the feeling before it can be
  // theirs. If the model claims ownership but their words don't bear it out, keep
  // it a hypothesis so the companion proposes-and-confirms instead of unlocking.
  if (fam && (ev.label_source === 'user_stated' || ev.label_source === 'user_confirmed')) {
    if (!labelIsUserOwned(fam, input.userText, input.history ?? [], prev ?? null)) {
      ev.label_source = 'companion_hypothesis';
      if (ev.user_confirmation === 'yes') ev.user_confirmation = 'partial';
    }
  }

  // Confirmation upgrade (capture fidelity §5.5): if the user explicitly ACCEPTED
  // the family already in play but the model under-reported provenance, mark it
  // user_confirmed so an accepted label consolidates to "understood" rather than
  // getting stuck at shaped. Gated to strong accept phrases + an in-play family.
  if (fam && fam === prev?.emotion_family && ev.label_source !== 'user_stated' && userConfirmsLabel(input.userText, prev)) {
    ev.label_source = 'user_confirmed';
    ev.user_confirmation = 'yes';
  }

  // Closing / still-uncertain backstop: a bare "yeah" on a turn that is winding the
  // conversation down ("yeah, leave it there") or still hedging is agreeing to STOP,
  // not owning the companion's last hypothesis. Unless the user actually NAMED this
  // family in their own words, keep it a hypothesis so a goodbye can't unlock a
  // feeling they never claimed. (robustness-sim: the "uncertain" persona, where a
  // closing "yeah" flipped an unconfirmed "self-critical" to understood.)
  if (
    fam &&
    (ev.label_source === 'user_stated' || ev.label_source === 'user_confirmed') &&
    (EXIT_CUE.test(input.userText) || uncertainTurn) &&
    !labelNamedByUser(fam, input.userText, input.history ?? [])
  ) {
    ev.label_source = 'companion_hypothesis';
    if (ev.user_confirmation === 'yes') ev.user_confirmation = 'partial';
  }

  // ── Shade ownership gate (v0.4 §6.3) ──────────────────────────────────────
  // A shade is the user's only when they used the word or accepted it; otherwise
  // it stays the companion's hypothesis (a candidate), never stored as their truth.
  // The user's exact phrase is the primary memory, preferred over taxonomy shade.
  // said = the user used the shade word themselves (this turn or earlier);
  // owned = said OR they accepted the SAME shade that was proposed last turn (not a
  // word the model just swapped in — that drift is what §6.3 guards against).
  const saidShade = shadeIsUserOwned(ev.emotion_shade, input.userText, input.history ?? []);
  const shadeOwned =
    saidShade ||
    shadeIsUserOwned(ev.emotion_shade, input.userText, input.history ?? [], { proposedShade: prev?.emotion_shade ?? null });
  ev.shade_source = !ev.emotion_shade ? null : saidShade ? 'user_stated' : shadeOwned ? 'user_confirmed' : 'companion_hypothesis';
  ev.candidate_shade = ev.emotion_shade && ev.shade_source === 'companion_hypothesis' ? ev.emotion_shade : null;

  // Clarifying-question guard: when the user is asking ABOUT the companion's words
  // ("what's the difference between quiet and settled?"), a feeling word inside that
  // question is not theirs to own — only an EARLIER turn (history, not this question)
  // can confer ownership. Stops a question being read as a decision/confirmation.
  if (clarifyingQuestion) {
    if (ev.emotion_shade && !shadeIsUserOwned(ev.emotion_shade, '', input.history ?? [])) {
      ev.shade_source = 'companion_hypothesis';
      ev.candidate_shade = ev.emotion_shade;
    }
    if (fam && (ev.label_source === 'user_stated' || ev.label_source === 'user_confirmed') && !labelNamedByUser(fam, '', input.history ?? [])) {
      ev.label_source = 'companion_hypothesis';
      if (ev.user_confirmation === 'yes') ev.user_confirmation = 'partial';
    }
  }

  // Intensity preservation (review #6): never downgrade the user's own intensity to a
  // milder synonym ("furious" must not become "frustrated"). If they voiced an intense
  // word this turn, that IS the shade; and once an intense word is owned, it holds
  // unless the user says it has eased — the companion follows shifts, never softens them.
  const userIntense = intenseUserWord(input.userText);
  if (userIntense && ev.emotion_shade && ev.emotion_shade.toLowerCase() !== userIntense && !INTENSE_FEELING.test(ev.emotion_shade)) {
    ev.emotion_shade = userIntense;
    ev.shade_source = 'user_stated';
    ev.candidate_shade = null;
  } else if (
    prev?.emotion_shade &&
    INTENSE_FEELING.test(prev.emotion_shade) &&
    ev.emotion_shade &&
    !INTENSE_FEELING.test(ev.emotion_shade) &&
    !SOFTENING_CUE.test(input.userText)
  ) {
    ev.emotion_shade = prev.emotion_shade;
    ev.shade_source = prev.shade_source ?? 'user_stated';
    ev.candidate_shade = null;
  }

  if (!input.intent) {
    const ownPhrase = uncertainTurn || clarifyingQuestion ? '' : (ev.user_words_raw ?? '').trim() || (input.userText ?? '').trim();
    // A shallow hedge ("yeah i guess") is not the feeling's phrase — keep the prior
    // meaningful one rather than overwriting it with a non-answer (brief §8).
    if (ownPhrase && !isUncertain(ownPhrase)) ev.user_phrase = stripEmDashes(ownPhrase).slice(0, 240);
    // else keep the prior meaningful phrase (don't replace it with uncertainty/empty)
  }

  // Mixed-emotion engine (brief §9): strands may be proposed freely; the mixed
  // structure is CONFIRMED (savable) only per the §9.3 rules.
  ev.strands = sanitizeStrands(p.strands);
  ev.mixed_confirmed = mixedConfirmed(ev, prev ?? null) ? 1 : 0;

  // ── Deterministic staging with the First-Shape confirmation gate ───────────
  const prevStage: UnlockStage = prev?.unlock_stage ?? 'noticed';
  const computed = fam ? evaluateStage(ev, prev ?? null) : 'noticed';
  // Stage never goes backwards within a conversation.
  let stage: UnlockStage = stageRank(computed) >= stageRank(prevStage) ? computed : prevStage;

  // A savoured GOOD feeling must not be turned into a learned shape: a positive family
  // plus a "let me just enjoy it, don't analyse" signal blocks the unlock and marks the
  // turn do-not-store so no memory is written either (brief §1).
  const savouring = isPositiveFamily(fam) && SAVOUR_RX.test(input.userText);
  if (savouring) ev.do_not_store = 1;

  // No progression at safety-sensitive moments (brief §13.4), on ANY tapped-chip turn
  // ("Stay with it" / "Not quite" / "I'm done"), on an UNCERTAIN turn ("not sure"), on
  // the turn right AFTER a "Not quite" correction (repairActive — no learning from the
  // repair), or while savouring: a first shape is earned from the person's own emotional
  // words, never from a button, an unsure beat, a correction, or a good mood.
  // State-text coherence (review action 5): if the companion's OWN draft says it has
  // not understood/named it ("not the whole shape", "I'm not sure", "leave it unnamed"),
  // the engine must not reach understood this turn — the voice and the state must agree.
  const tentativeReply = isTentativeReply(p.reply);
  // Stricter unlock gate (review actions 1, 9): a first shape is earned from the user's
  // OWN words, not the model's extractions — require at least one concrete detail (body
  // cue, urge, trigger, meaning, or owned phrase) the user actually voiced. This blocks
  // unlocks built only on bare agreement, echoes, or companion-supplied detail.
  const noUserConcrete = !hasUserOwnedConcreteDetail(ev, input.userText, input.history ?? []);
  // Conversation-level ownership (review #1/#2): the user must have ORIGINATED a felt
  // word somewhere (not just echoed the companion's). Closes the shallow-agreement case
  // the turn-local gate can't — agreeing with / parroting the companion is never a shape.
  const neverOriginated = !userHasOriginated(input.history ?? [], input.userText);
  // Final-turn guard (review #6): a goodbye / thanks / "I'll leave it there" turn must not
  // crystallise a feeling unless the user NAMES and OWNS it in THIS very message. Ending a
  // conversation well shouldn't force an unlock of something they only owned earlier (or
  // never did) — the unlock should have landed on the owning turn, not the farewell. Empty
  // history forces a "this message only" read, so a genuine final-message naming ("oh — it's
  // grief, that's the word") still unlocks, while "thanks, bye" cannot.
  const namesAndOwnsThisMessage =
    !!fam && labelNamedByUser(fam, input.userText, []) && hasUserOwnedConcreteDetail(ev, input.userText, []);
  const blockUnlock =
    !!input.safetyNote ||
    !!input.intent ||
    uncertainTurn ||
    clarifyingQuestion ||
    tentativeReply ||
    noUserConcrete ||
    neverOriginated ||
    !!input.repairActive ||
    savouring ||
    (EXIT_CUE.test(input.userText) && !namesAndOwnsThisMessage);
  if (blockUnlock && stage === 'understood' && prevStage !== 'understood' && prevStage !== 'deepened') {
    stage = prevStage;
  }
  ev.unlock_stage = stage;

  const understoodNow = stage === 'understood';
  const wasUnderstood = prevStage === 'understood' || prevStage === 'deepened';
  let unlocked = understoodNow && !wasUnderstood;

  ev.emotion_status = fam ? (understoodNow ? 'confirmed' : 'candidate') : 'unclear';
  if (understoodNow && ev.user_confirmation === 'unknown') ev.user_confirmation = 'partial';

  const tone = fam ? EMOTION_MAPS[fam].tone : 'calm';

  // ── Visible-reply ownership gate (§5.1) ────────────────────────────────────
  // The unlock gate protects the record; this protects the spoken sentence. If
  // the label isn't user-owned but the reply asserts the feeling as fact, repair
  // it: one constrained re-call for natural tentative language, deterministic
  // softening as a fallback.
  let reply = p.reply;

  // Clarifying-question repair: if the user asked the companion to explain/distinguish
  // its words, the reply must ANSWER that, not declare a feeling. Re-call once with a
  // pointed instruction so the companion stops treating the question as a decision.
  if (clarifyingQuestion) {
    try {
      const pq = await callOnce(
        'The user asked you a QUESTION about your own words (for example the difference between two ' +
          'feeling words you offered). ANSWER it directly, warmly, in 1-2 short plain sentences. Do NOT ' +
          'treat their question as choosing or confirming a feeling: never say "this is X", "I\'m learning ' +
          'this is X", or call their feeling settled/named. After answering, you may gently invite them to ' +
          'notice which fits, but leave it theirs to say.',
      );
      if (pq.reply && pq.reply.trim()) reply = pq.reply;
    } catch {
      /* keep the original draft; the ownership repair below still applies */
    }
  }

  const owned = ev.label_source === 'user_stated' || ev.label_source === 'user_confirmed';
  if (needsOwnershipRepair(reply, ev, owned)) {
    try {
      const p2 = await callOnce(
        'OWNERSHIP REPAIR: your draft stated a feeling as fact that this person has not named or accepted yet. ' +
          'Rewrite ONLY the reply so the feeling is offered tentatively, or left unnamed, and stays theirs to confirm. ' +
          'Do not write "this is X", "you are X", "the X underneath", or "the shape of X". Keep it to 1-2 short sentences, ' +
          'at most one gentle question.',
      );
      reply = p2.reply && !needsOwnershipRepair(p2.reply, ev, owned) ? p2.reply : softenUnownedEmotionReply(reply, ev);
    } catch {
      reply = softenUnownedEmotionReply(reply, ev);
    }
  }

  // Unlock-turn rest (§5.3): a first shape must land without a refining question.
  if (unlocked) reply = dropTrailingQuestion(reply);

  // Option-menu cap (v0.4 §4.1/§6.2): the "is it more X, Y, or...?" menu had become
  // the new crutch — it evades the scaffold suppressor and turns the companion into
  // a label-picker. Allow at most ONE per conversation, and none in the opening two
  // turns unless they explicitly ask for help naming it. Over the cap, swap the menu
  // for an open question in THEIR language.
  const priorMenus = companionReplies.filter(isOptionMenu).length;
  const overMenuCap = priorMenus >= 1 || (companionReplies.length < 2 && !askedForNamingHelp(input.userText));
  if (isOptionMenu(reply) && overMenuCap) {
    // Rotate the replacement by turn count (not menu count, which the swap itself
    // resets to 0) and skip the previous turn's doorway, so a menu swap never lands
    // on the same canned open question two turns running.
    const lastDoor = companionReplies.length ? doorwayOf(companionReplies[companionReplies.length - 1]) : null;
    reply = replaceOptionMenu(reply, companionReplies.length, lastDoor);
  }

  // Exit-cue rest (v0.4 §6.3): if they're signalling they're done, don't grab them
  // with a probing question — let them leave on a settled note.
  if (EXIT_CUE.test(input.userText)) reply = dropTrailingQuestion(reply);

  // No exit to someone who just tapped "stay with it": they explicitly chose to keep
  // going, so offering "leave it here / keep it unnamed" in the same breath is wrong
  // (the unlock-sim showed this on every premature off-ramp). Strip the off-ramp.
  if (input.intent === 'keep_going' && offersOffRamp(reply)) reply = stripOffRamp(reply);

  // State-text coherence backstop (review action 5): never ship an unlock whose final
  // reply still hedges that it hasn't named the feeling. Cancel it, hold at shaped, so
  // the recorded state matches the spoken voice. Acts only on the new-unlock turn.
  if (unlocked && isTentativeReply(reply)) {
    unlocked = false;
    ev.unlock_stage = stage = 'shaped';
    ev.emotion_status = fam ? 'candidate' : 'unclear';
  }

  return { reply: stripEmDashes(stripControlChars(reply)), event: ev, unlocked, tone, stage };
}
