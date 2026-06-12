/**
 * App store (Zustand). Owns the conversation state machine and wiring between the
 * AI service, persistence and UI. The model proposes; this store decides — safety
 * pre-check runs before any companion reply, and unlock/stage logic lives here.
 */

import { create } from 'zustand';

import { ai, cloudAvailable } from '@/services/ai/aiClient';
import type { CompanionTurn } from '@/services/ai/companionEngine';
import { tintLevelForStage } from '@/services/ai/companionVisualState';
import {
  DEPENDENCY_NOTE,
  gentleCheckCopy,
  RESUME_NOTE,
  RESUME_SOFT_NOTE,
  resolveSafetyCheck,
  type SafetyCategory,
} from '@/services/ai/safety';
import {
  getApiKey,
  getModel,
  setApiKey as persistApiKey,
  setModel as persistModel,
} from '@/services/ai/keyStore';
import { initDb } from '@/services/db/persistence';
import {
  clearAllData,
  conversationsRepo,
  emotionEventsRepo,
  emotionProgressRepo,
  memoryCardsRepo,
  messagesRepo,
  safetyEventsRepo,
  settingsRepo,
} from '@/services/db/repos';
import type { ChipIntent, ConversationMode } from '@/services/ai/modeRouter';
import { composeLearningSentence, summaryIsClean } from '@/services/ai/learningSentence';
import { advanceProgress, migrateStage, PROGRESS_RANK, type AdvanceResult } from '@/services/ai/progressionEngine';
import { hasEmotionAnchor, isUncertain } from '@/services/ai/stage';
import { draftFromRejection, draftFromTurn, relevantMemory } from '@/services/memoryLedger';
import { buildWeeklySummary } from '@/services/weeklySummary';
import { UK_SUPPORT_ROUTES } from '@/data/safetyResources';
import type {
  Conversation,
  EmotionEvent,
  EmotionFamilyId,
  EmotionProgress,
  MemoryCard,
  Message,
  SafetyEvent,
  WeeklySummary,
} from '@/types/models';
import { nowIso, startOfWeek, weekKeyOf } from '@/utils/date';
import { genId } from '@/utils/ids';
import { stripEmDashes } from '@/utils/text';

// NOTE (engine brief §12): conversational memory now comes ONLY from the
// user-confirmed Memory Ledger (relevantMemory) — never from silently
// accumulated progress rows. emotion_progress remains progression mechanics
// (the §13 stage ladder, owned by progressionEngine.ts).

interface SafetyState {
  visible: boolean;
  level: number;
  category: string;
}

/** A pending level-2 gentle check: set when the clarifier is shown, resolved on the next user message. */
interface PendingSafetyCheck {
  category: SafetyCategory;
}

/** Which ceremony the unlock card shows (brief §6.4–6.6). */
export type UnlockKind = 'first_shape' | 'deepened' | 'mixed';

/** The user is on their way out — used to soften a gentle safety check (v0.4 §5.1.4). */
const EXIT_CUE =
  /\b(gotta go|got to go|gonna go|going to bed|off to bed|goodnight|good night|im done|i'?m done|leave it (here|there)|talk later|im off|head off|heading off|going now|bye|see you|night night|gtg)\b/;

interface AppState {
  ready: boolean;
  conversationId: string | null;
  messages: Message[];
  draftEvent: EmotionEvent | null;
  progress: Partial<Record<EmotionFamilyId, EmotionProgress>>;
  orbFamily: EmotionFamilyId | null;
  /** The feeling (+ how fully coloured) from the last chat, so the home orb can fade
   *  slowly from it back to idle blue when you return. Consumed by the home screen. */
  chatExitEmotion: { family: EmotionFamilyId; level: number } | null;
  /** Emotion families described TODAY (local date) — drives the very subtle daily hues
   *  on the home orb. Resets back to none when the date rolls over (midnight). */
  todaysEmotions: { date: string; families: EmotionFamilyId[] };
  sending: boolean;
  unlock: { event: EmotionEvent; kind: UnlockKind } | null;
  safety: SafetyState;
  safetyCheck: PendingSafetyCheck | null;
  /** v0.4 §5.1.2: the user already confirmed they're safe this conversation, so a
   * gentle check must not re-fire. Reset per conversation. */
  safetyClarified: boolean;
  /** All persisted memory cards (active ones power retrieval; UI lists them). */
  memoryCards: MemoryCard[];
  /** Stance chosen at the door (home chip) — biases the first companion turn, then clears. */
  entryMode: ConversationMode | null;
  /** Lightweight repair state after a "Not quite": the reading the user waved off, and
   * their preferred word once they give one. Session-scoped; never auto-saved to memory.
   * `noLearningNextTurn` opens a one-turn No-Learning Zone for the next free-text turn. */
  repair: { rejected: string; preferred: string | null; noLearningNextTurn?: boolean } | null;
  weekly: WeeklySummary | null;
  userName: string;
  remindersEnabled: boolean;
  apiKeySet: boolean;
  aiModel: string;
  cloudActive: boolean;

  init: () => Promise<void>;
  newConversation: () => Promise<string>;
  attachConversation: (cid: string) => Promise<void>;
  greet: (text: string) => Promise<void>;
  send: (text: string, opts?: { intent?: ChipIntent | null }) => Promise<void>;
  dismissUnlock: () => void;
  dismissSafety: () => void;
  dismissWeekly: () => void;
  deleteMemoryCard: (id: string) => Promise<void>;
  setUserName: (name: string) => Promise<void>;
  setReminders: (on: boolean) => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  setModel: (model: string) => Promise<void>;
  resetAllData: () => Promise<void>;
  _updateProgress: (turn: CompanionTurn, conversationId: string, suppress: boolean) => Promise<AdvanceResult | null>;
}

/** Local calendar date (YYYY-M-D) — the boundary for the daily-hue midnight reset. */
function localDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Add a family to today's set, resetting it when the calendar date has rolled over. */
function addTodaysEmotion(prev: { date: string; families: EmotionFamilyId[] }, fam: EmotionFamilyId) {
  const today = localDateString();
  if (prev.date !== today) return { date: today, families: [fam] };
  return prev.families.includes(fam) ? prev : { date: today, families: [...prev.families, fam] };
}

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  conversationId: null,
  messages: [],
  draftEvent: null,
  progress: {},
  orbFamily: null,
  chatExitEmotion: null,
  todaysEmotions: { date: '', families: [] },
  sending: false,
  unlock: null,
  safety: { visible: false, level: 0, category: 'none' },
  safetyCheck: null,
  safetyClarified: false,
  memoryCards: [],
  entryMode: null,
  repair: null,
  weekly: null,
  userName: '',
  remindersEnabled: false,
  apiKeySet: false,
  aiModel: 'gpt-5.4-mini',
  cloudActive: false,

  init: async () => {
    await initDb();
    try {
      const [key, model, cloud] = await Promise.all([getApiKey(), getModel(), cloudAvailable()]);
      set({ apiKeySet: !!key, aiModel: model, cloudActive: cloud });
    } catch {
      // no key configured — local engine
    }
    try {
      const list = await emotionProgressRepo.all();
      const progress: Partial<Record<EmotionFamilyId, EmotionProgress>> = {};
      for (const raw of list) {
        // Migrate legacy 5-stage rows onto the §13 8-stage model in place.
        const p: EmotionProgress = {
          ...raw,
          current_stage: migrateStage(raw.current_stage as string),
          return_count: raw.return_count ?? 0,
          last_conversation_id: raw.last_conversation_id ?? null,
        };
        progress[p.emotion_family] = p;
      }
      set({ progress });
    } catch {
      // ignore — start with empty progress
    }
    try {
      set({ memoryCards: await memoryCardsRepo.all() });
    } catch {
      // ignore — start with no memories
    }

    // Present the weekly summary once at the start of a new week (brief §11.7).
    try {
      const settings = await settingsRepo.get();
      set({ userName: settings.user_name ?? '', remindersEnabled: settings.reminders_enabled === 1 });
      const thisWeek = weekKeyOf();
      const events = await emotionEventsRepo.all();
      const hasData = events.some((e) => !e.do_not_store && e.emotion_family);
      if (hasData && settings.last_weekly_week !== thisWeek) {
        const summary = await buildWeeklySummary(startOfWeek());
        set({ weekly: summary });
        await settingsRepo.save({ ...settings, last_weekly_week: thisWeek, updated_at: nowIso() });
      }
    } catch {
      // never block startup on the weekly summary
    }

    set({ ready: true });
  },

  newConversation: async () => {
    const id = genId('conv');
    const now = nowIso();
    const conv: Conversation = {
      id,
      created_at: now,
      updated_at: now,
      title: null,
      status: 'active',
      primary_emotion_family: null,
      primary_emotion_shade: null,
      safety_level: 0,
    };
    // Set state synchronously first so callers can immediately greet/send into it.
    set({ conversationId: id, messages: [], draftEvent: null, orbFamily: null, unlock: null, safetyCheck: null, safetyClarified: false, entryMode: null, repair: null });
    conversationsRepo.save(conv).catch(() => {});
    return id;
  },

  // Re-bind the store to an existing conversation (identified by the URL) and
  // rehydrate its messages + working emotion event from persistence. This makes
  // the conversation survive a store reset (dev Fast Refresh, or a real reload).
  attachConversation: async (cid) => {
    set({ conversationId: cid, unlock: null, safetyCheck: null, safetyClarified: false });
    try {
      const msgs = await messagesRepo.listByConversation(cid);
      const events = (await emotionEventsRepo.all())
        .filter((e) => e.conversation_id === cid)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const draft = events.length ? events[events.length - 1] : null;
      if (get().conversationId === cid)
        set({ messages: msgs, draftEvent: draft, orbFamily: draft?.emotion_family ?? null });
    } catch {
      // leave whatever is in memory
    }
  },

  greet: async (text) => {
    const convId = get().conversationId ?? (await get().newConversation());
    const msg: Message = {
      id: genId('msg'),
      conversation_id: convId,
      role: 'companion',
      content: stripEmDashes(text),
      created_at: nowIso(),
      ai_generated: 1,
      safety_flag: 'none',
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    await messagesRepo.add(msg).catch(() => {});
  },

  send: async (text, opts) => {
    const clean = text.trim();
    if (!clean || get().sending) return;
    const intent = opts?.intent ?? null;
    // The user is unsure this turn ("not sure", "i dont know"): the companion stays
    // curious, never learns — no stage advance, no deepening, no memory.
    const uncertain = !intent && isUncertain(clean);

    const convId = get().conversationId ?? (await get().newConversation());

    // Capture prior context before adding the new user message.
    const priorMessages = get().messages;

    const userMsg: Message = {
      id: genId('msg'),
      conversation_id: convId,
      role: 'user',
      content: clean,
      created_at: nowIso(),
      ai_generated: 0,
      safety_flag: 'none',
    };
    set((s) => ({ messages: [...s.messages, userMsg] }));
    await messagesRepo.add(userMsg).catch(() => {});

    // ── Safety ladder (engine brief §15) — always before a companion reply ───
    // 3/4: pause flow, show support/urgent modal. 2: deterministic gentle
    // clarifier in-chat, resolved by the NEXT user message. 1: stay in
    // conversation with a softening/boundary directive to the model.
    const safety = ai.classifySafety(clean);
    const pendingCheck = get().safetyCheck;

    const pauseWithModal = async (level: number, category: string) => {
      userMsg.safety_flag = 'urgent_review';
      await messagesRepo.add(userMsg).catch(() => {});
      const ev: SafetyEvent = {
        id: genId('safe'),
        conversation_id: convId,
        created_at: nowIso(),
        level,
        category,
        trigger_excerpt: clean.slice(0, 140),
        resources_shown: UK_SUPPORT_ROUTES.map((r) => r.label),
        dismissed_at: null,
        retriggered: get().safety.visible ? 1 : 0,
      };
      await safetyEventsRepo.add(ev).catch(() => {});
      const conv = await conversationsRepo.get(convId);
      if (conv) {
        conv.safety_level = Math.max(conv.safety_level, level);
        conv.updated_at = nowIso();
        await conversationsRepo.save(conv).catch(() => {});
      }
      set({ safety: { visible: true, level, category }, safetyCheck: null });
    };

    let safetyNote: string | null = null;

    if (pendingCheck) {
      // This message answers the gentle clarifier.
      set({ safetyCheck: null });
      const outcome = safety.level >= 3 ? 'escalate' : resolveSafetyCheck(clean);
      if (outcome === 'escalate') {
        await pauseWithModal(Math.max(safety.level, 3), safety.level >= 3 ? safety.category : pendingCheck.category);
        return;
      }
      // They confirmed they're safe — never re-run the check this conversation (§5.1.2).
      set({ safetyClarified: true });
      safetyNote = outcome === 'resume' ? RESUME_NOTE : RESUME_SOFT_NOTE;
    } else if (safety.level >= 3) {
      await pauseWithModal(safety.level, safety.category);
      return;
    } else if (safety.level === 2 && !get().safetyClarified) {
      // Deterministic two-beat gentle check (v0.4 §4.2) — reflect, then a STANDALONE
      // safety question. No model call, no modal, conversation preserved. Softer if
      // they're heading out.
      const exiting = EXIT_CUE.test(` ${clean.toLowerCase().replace(/[’']/g, "'")} `);
      const checkMsg: Message = {
        id: genId('msg'),
        conversation_id: convId,
        role: 'companion',
        content: stripEmDashes(gentleCheckCopy(safety.category, { exit: exiting })),
        created_at: nowIso(),
        ai_generated: 0,
        safety_flag: 'mild_concern',
      };
      set((s) => ({ messages: [...s.messages, checkMsg], safetyCheck: { category: safety.category } }));
      await messagesRepo.add(checkMsg).catch(() => {});
      const ev: SafetyEvent = {
        id: genId('safe'),
        conversation_id: convId,
        created_at: nowIso(),
        level: 2,
        category: safety.category,
        trigger_excerpt: clean.slice(0, 140),
        resources_shown: [],
        dismissed_at: null,
        retriggered: 0,
      };
      await safetyEventsRepo.add(ev).catch(() => {});
      return;
    } else if (safety.level === 2) {
      // Already confirmed safe earlier — don't re-interrogate; stay gentle (§5.1.2).
      safetyNote = RESUME_SOFT_NOTE;
    } else if (safety.category === 'dependency') {
      safetyNote = DEPENDENCY_NOTE;
    }

    // ── Normal companion turn ────────────────────────────────────────────────
    set({ sending: true });
    try {
      const history = priorMessages
        .filter((m) => m.role === 'user' || m.role === 'companion')
        .slice(-8)
        .map((m) => ({ role: m.role as 'user' | 'companion', content: m.content }));

      let prevDraft = get().draftEvent;
      // No-Learning Zone: the free-text turn right after a "Not quite" must not unlock,
      // deepen, or write memory — a correction is not a learning shortcut (brief §4).
      // Consume the one-turn flag here (taps don't consume it; they're suppressed anyway).
      const repairActive = !intent && get().repair?.noLearningNextTurn === true;
      if (repairActive) set((s) => ({ repair: s.repair ? { ...s.repair, noLearningNextTurn: false } : null }));
      // "Not quite" — the user is correcting the companion's reading. Before the
      // repair turn, mark the current interpretation rejected and not user-owned, so
      // it cannot unlock or be saved and is never re-proposed (§ state requirements).
      if (intent === 'not_quite' && prevDraft?.emotion_family) {
        const rejectedFamily = prevDraft.emotion_family;
        const rejectedShade = prevDraft.emotion_shade?.trim() || null;
        const rejected = new Set(prevDraft.user_rejected_shades ?? []);
        if (rejectedShade) rejected.add(rejectedShade);
        prevDraft = {
          ...prevDraft,
          user_rejected_shades: [...rejected],
          label_source: 'companion_hypothesis',
          shade_source: 'companion_hypothesis',
          user_confirmation: 'no',
        };
        set({ draftEvent: prevDraft, repair: { rejected: rejectedShade ?? rejectedFamily, preferred: null, noLearningNextTurn: true } });
      }
      // The entry-chip stance biases only the first turn, then clears.
      const entryHint = get().entryMode;
      if (entryHint) set({ entryMode: null });
      const turn = await ai.generateTurn({
        userText: clean,
        prevEvent: prevDraft,
        conversationId: convId,
        history,
        memory: relevantMemory(get().memoryCards, clean, prevDraft?.emotion_family ?? null),
        userName: get().userName || null,
        safetyNote,
        entryHint,
        intent,
        repairActive,
      });

      const compMsg: Message = {
        id: genId('msg'),
        conversation_id: convId,
        role: 'companion',
        content: stripEmDashes(turn.reply),
        created_at: nowIso(),
        ai_generated: 1,
        safety_flag: 'none',
      };
      const exitFam = turn.event.emotion_family ?? null;
      set((s) => ({
        messages: [...s.messages, compMsg],
        draftEvent: turn.event,
        orbFamily: exitFam,
        // Remember the feeling + how fully it had coloured the orb, so the home orb can
        // fade slowly from it back to blue. Keep the last one if this turn has no family.
        chatExitEmotion: exitFam ? { family: exitFam, level: tintLevelForStage(turn.event.unlock_stage) } : s.chatExitEmotion,
        // Record it among today's feelings (for the subtle daily hues on the home orb).
        todaysEmotions: exitFam ? addTodaysEmotion(s.todaysEmotions, exitFam) : s.todaysEmotions,
      }));
      await messagesRepo.add(compMsg).catch(() => {});
      await emotionEventsRepo.upsert(turn.event).catch(() => {});
      // Suppress stage progression on safety-sensitive, tapped-chip, or uncertain
      // turns — the companion only learns from real, user-owned emotional evidence,
      // never from a button tap or "not sure".
      const adv = await get()._updateProgress(turn, convId, !!safetyNote || !!intent || uncertain || repairActive);

      // A typed correction may give us the word the companion was reaching for —
      // record it as the preferred session label (never auto-saved to memory).
      if (intent === null && get().repair && turn.event.emotion_family) {
        const owned = turn.event.label_source === 'user_stated' || turn.event.label_source === 'user_confirmed';
        const word = turn.event.emotion_shade?.trim() || turn.event.emotion_family;
        if (owned && word && word.toLowerCase() !== get().repair!.rejected.toLowerCase()) {
          set((s) => ({ repair: s.repair ? { ...s.repair, preferred: word } : null }));
        }
      }

      // ── Auto-learned memory (brief §12.3, simplified) ──────────────────────
      // The companion remembers settled moments on its own — a first shape, a
      // confirmed mixed structure, an explicit "remember this", or a correction
      // it shouldn't repeat. No Save / Edit / Not this prompt (it felt
      // repetitive); the user can delete any memory, and sensitive content is
      // still never stored (handled inside the drafters via memoryBlocked).
      // A button tap ("Stay with it" / "Not quite" / "I'm done"), an unsure turn
      // ("not sure"), or the turn right after a "Not quite" (No-Learning Zone) never
      // silently creates a memory — the companion only keeps real, user-owned moments.
      if (!safetyNote && !intent && !uncertain && !repairActive) {
        let learned = draftFromTurn(turn, clean, convId);
        if (!learned) {
          const before = new Set(prevDraft?.user_rejected_shades ?? []);
          const newlyRejected = (turn.event.user_rejected_shades ?? []).filter((s) => !before.has(s));
          if (newlyRejected.length) learned = draftFromRejection(newlyRejected, turn.event.emotion_family, convId);
        }
        if (learned) {
          const key = learned.summary.trim().toLowerCase();
          const dup = get().memoryCards.some((c) => c.summary.trim().toLowerCase() === key);
          if (!dup) {
            const card: MemoryCard = { ...learned, confirmation_status: 'auto_learned', updated_at: nowIso() };
            set((s) => ({ memoryCards: [...s.memoryCards, card] }));
            await memoryCardsRepo.save(card).catch(() => {});
          }
        }
      }

      if (turn.unlocked) {
        // First shape (brief §6.4) — or a confirmed mixed structure that lands one (§6.6).
        // The ceremony only shows if the learned sentence is genuinely clean (§13); a
        // hollow/identity-reinforcing summary keeps the progress internal, no modal.
        const fsKind = turn.event.mixed_confirmed === 1 ? 'mixed' : 'first_shape';
        if (summaryIsClean(composeLearningSentence(turn.event, fsKind), turn.event)) {
          set({ unlock: { event: turn.event, kind: fsKind } });
        }
        const conv = await conversationsRepo.get(convId);
        if (conv) {
          conv.primary_emotion_family = turn.event.emotion_family;
          conv.primary_emotion_shade = turn.event.emotion_shade;
          conv.updated_at = nowIso();
          await conversationsRepo.save(conv).catch(() => {});
        }
      } else if (
        !safetyNote &&
        !intent &&
        !uncertain &&
        !repairActive &&
        adv?.advanced &&
        PROGRESS_RANK[adv.from] >= PROGRESS_RANK.first_shape &&
        (adv.to === 'distinguished' || adv.to === 'deepened' || adv.to === 'returning') &&
        hasEmotionAnchor(turn.event)
      ) {
        // Deepening (brief §6.5): an already-understood feeling gained a new shade,
        // distinction, mixed structure, or returned. A quieter, intimate ceremony.
        // Never from a button tap, an unsure turn, or a turn with no real anchor, and
        // only when the learned sentence is clean (§13).
        const deepKind = turn.event.mixed_confirmed === 1 ? 'mixed' : 'deepened';
        if (summaryIsClean(composeLearningSentence(turn.event, deepKind), turn.event)) {
          set({ unlock: { event: turn.event, kind: deepKind } });
        }
      }
    } finally {
      set({ sending: false });
    }
  },

  _updateProgress: async (turn, conversationId, suppress) => {
    const fam = turn.event.emotion_family;
    const existing = fam
      ? (get().progress[fam] ?? (await emotionProgressRepo.get(fam).catch(() => null)))
      : null;

    const result = advanceProgress(existing, turn, conversationId, { suppress });

    if (fam) {
      await emotionProgressRepo.save(result.progress).catch(() => {});
      set((s) => ({ progress: { ...s.progress, [fam]: result.progress } }));
    }

    // Capability evidence counters (§13.1) — accumulated on the settings doc.
    const deltas = Object.entries(result.capabilities);
    if (deltas.length) {
      try {
        const settings = await settingsRepo.get();
        const caps = { ...(settings.capabilities ?? {}) };
        for (const [k, v] of deltas) caps[k as keyof typeof caps] = (caps[k as keyof typeof caps] ?? 0) + (v ?? 0);
        await settingsRepo.save({ ...settings, capabilities: caps, updated_at: nowIso() });
      } catch {
        // counters are best-effort
      }
    }
    return fam ? result : null;
  },

  dismissUnlock: () => set({ unlock: null }),
  dismissSafety: () => set((s) => ({ safety: { ...s.safety, visible: false } })),
  dismissWeekly: () => set({ weekly: null }),

  deleteMemoryCard: async (id) => {
    set((s) => ({ memoryCards: s.memoryCards.filter((c) => c.id !== id) }));
    await memoryCardsRepo.remove(id).catch(() => {});
  },

  setUserName: async (name) => {
    const clean = name.trim();
    set({ userName: clean });
    const settings = await settingsRepo.get().catch(() => ({ id: 'app' }));
    await settingsRepo.save({ ...settings, user_name: clean, updated_at: nowIso() }).catch(() => {});
  },

  setReminders: async (on) => {
    set({ remindersEnabled: on });
    const settings = await settingsRepo.get().catch(() => ({ id: 'app' }));
    await settingsRepo.save({ ...settings, reminders_enabled: on ? 1 : 0, updated_at: nowIso() }).catch(() => {});
  },

  setApiKey: async (key) => {
    await persistApiKey(key).catch(() => {});
    set({ apiKeySet: !!key.trim(), cloudActive: await cloudAvailable() });
  },

  setModel: async (model) => {
    await persistModel(model).catch(() => {});
    set({ aiModel: model.trim() || 'gpt-5.4-mini' });
  },

  resetAllData: async () => {
    await clearAllData().catch(() => {});
    set({
      conversationId: null,
      messages: [],
      draftEvent: null,
      progress: {},
      orbFamily: null,
      unlock: null,
      safetyCheck: null,
      safetyClarified: false,
      memoryCards: [],
      entryMode: null,
      repair: null,
      weekly: null,
      userName: '',
      remindersEnabled: false,
    });
  },
}));
