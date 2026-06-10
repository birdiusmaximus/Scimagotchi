/**
 * App store (Zustand). Owns the conversation state machine and wiring between the
 * AI service, persistence and UI. The model proposes; this store decides — safety
 * pre-check runs before any companion reply, and unlock/stage logic lives here.
 */

import { create } from 'zustand';

import { ai, cloudAvailable } from '@/services/ai/aiClient';
import type { CompanionTurn } from '@/services/ai/companionEngine';
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
  UnlockStage,
  WeeklySummary,
} from '@/types/models';
import { nowIso, startOfWeek, weekKeyOf } from '@/utils/date';
import { genId } from '@/utils/ids';

const STAGE_RANK: Record<UnlockStage, number> = {
  noticed: 0,
  named: 1,
  shaped: 2,
  understood: 3,
  deepened: 4,
};

function pushUnique(arr: string[], value: string) {
  const v = value.trim();
  if (v && !arr.includes(v)) arr.push(v);
}

// NOTE (engine brief §12): conversational memory now comes ONLY from the
// user-confirmed Memory Ledger (relevantMemory) — never from silently
// accumulated progress rows. emotion_progress remains progression mechanics.

interface SafetyState {
  visible: boolean;
  level: number;
  category: string;
}

/** A pending level-2 gentle check: set when the clarifier is shown, resolved on the next user message. */
interface PendingSafetyCheck {
  category: SafetyCategory;
}

interface AppState {
  ready: boolean;
  conversationId: string | null;
  messages: Message[];
  draftEvent: EmotionEvent | null;
  progress: Partial<Record<EmotionFamilyId, EmotionProgress>>;
  orbFamily: EmotionFamilyId | null;
  sending: boolean;
  unlock: { event: EmotionEvent } | null;
  safety: SafetyState;
  safetyCheck: PendingSafetyCheck | null;
  /** All persisted memory cards (confirmed ones power retrieval; UI lists them). */
  memoryCards: MemoryCard[];
  /** A drafted memory awaiting the user's Save / Edit / Not this. Never persisted as-is. */
  memoryDraft: MemoryCard | null;
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
  send: (text: string) => Promise<void>;
  dismissUnlock: () => void;
  dismissSafety: () => void;
  dismissWeekly: () => void;
  confirmMemoryDraft: () => Promise<void>;
  editMemoryDraft: (summary: string) => Promise<void>;
  rejectMemoryDraft: () => void;
  deleteMemoryCard: (id: string) => Promise<void>;
  setUserName: (name: string) => Promise<void>;
  setReminders: (on: boolean) => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  setModel: (model: string) => Promise<void>;
  resetAllData: () => Promise<void>;
  _updateProgress: (turn: CompanionTurn) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  ready: false,
  conversationId: null,
  messages: [],
  draftEvent: null,
  progress: {},
  orbFamily: null,
  sending: false,
  unlock: null,
  safety: { visible: false, level: 0, category: 'none' },
  safetyCheck: null,
  memoryCards: [],
  memoryDraft: null,
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
      for (const p of list) progress[p.emotion_family] = p;
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
    set({ conversationId: id, messages: [], draftEvent: null, orbFamily: null, unlock: null, safetyCheck: null, memoryDraft: null });
    conversationsRepo.save(conv).catch(() => {});
    return id;
  },

  // Re-bind the store to an existing conversation (identified by the URL) and
  // rehydrate its messages + working emotion event from persistence. This makes
  // the conversation survive a store reset (dev Fast Refresh, or a real reload).
  attachConversation: async (cid) => {
    set({ conversationId: cid, unlock: null, safetyCheck: null });
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
      content: text,
      created_at: nowIso(),
      ai_generated: 1,
      safety_flag: 'none',
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    await messagesRepo.add(msg).catch(() => {});
  },

  send: async (text) => {
    const clean = text.trim();
    if (!clean || get().sending) return;

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
      safetyNote = outcome === 'resume' ? RESUME_NOTE : RESUME_SOFT_NOTE;
    } else if (safety.level >= 3) {
      await pauseWithModal(safety.level, safety.category);
      return;
    } else if (safety.level === 2) {
      // Deterministic gentle check — no model call, no modal, conversation preserved.
      const checkMsg: Message = {
        id: genId('msg'),
        conversation_id: convId,
        role: 'companion',
        content: gentleCheckCopy(safety.category),
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

      const prevDraft = get().draftEvent;
      const turn = await ai.generateTurn({
        userText: clean,
        prevEvent: prevDraft,
        conversationId: convId,
        history,
        memory: relevantMemory(get().memoryCards, clean, prevDraft?.emotion_family ?? null),
        userName: get().userName || null,
        safetyNote,
      });

      const compMsg: Message = {
        id: genId('msg'),
        conversation_id: convId,
        role: 'companion',
        content: turn.reply,
        created_at: nowIso(),
        ai_generated: 1,
        safety_flag: 'none',
      };
      set((s) => ({
        messages: [...s.messages, compMsg],
        draftEvent: turn.event,
        orbFamily: turn.event.emotion_family ?? null,
      }));
      await messagesRepo.add(compMsg).catch(() => {});
      await emotionEventsRepo.upsert(turn.event).catch(() => {});
      await get()._updateProgress(turn);

      // ── Memory drafting (brief §12.3) — propose, never silently persist ────
      if (!get().memoryDraft && !safetyNote) {
        let draft = draftFromTurn(turn, clean, convId);
        if (!draft) {
          const before = new Set(prevDraft?.user_rejected_shades ?? []);
          const newlyRejected = (turn.event.user_rejected_shades ?? []).filter((s) => !before.has(s));
          if (newlyRejected.length) draft = draftFromRejection(newlyRejected, turn.event.emotion_family, convId);
        }
        if (draft) set({ memoryDraft: draft });
      }

      if (turn.unlocked) {
        set({ unlock: { event: turn.event } });
        const conv = await conversationsRepo.get(convId);
        if (conv) {
          conv.primary_emotion_family = turn.event.emotion_family;
          conv.primary_emotion_shade = turn.event.emotion_shade;
          conv.updated_at = nowIso();
          await conversationsRepo.save(conv).catch(() => {});
        }
      }
    } finally {
      set({ sending: false });
    }
  },

  _updateProgress: async (turn) => {
    const ev = turn.event;
    const fam = ev.emotion_family;
    if (!fam) return;

    const existing = get().progress[fam] ?? (await emotionProgressRepo.get(fam).catch(() => null));
    const p: EmotionProgress =
      existing ?? {
        id: fam,
        emotion_family: fam,
        current_stage: 'noticed',
        introduced_at: nowIso(),
        first_shape_at: null,
        deepened_at: null,
        confirmed_shades: [],
        common_triggers: [],
        common_body_cues: [],
        common_user_phrases: [],
        memory_summary: null,
        updated_at: nowIso(),
      };

    if (STAGE_RANK[turn.stage] > STAGE_RANK[p.current_stage]) {
      p.current_stage = turn.stage;
    }

    if (turn.unlocked) {
      if (p.first_shape_at) {
        p.current_stage = 'deepened';
        p.deepened_at = nowIso();
      } else {
        p.current_stage = 'understood';
        p.first_shape_at = nowIso();
      }
      if (ev.emotion_shade) pushUnique(p.confirmed_shades, ev.emotion_shade);
      if (ev.trigger_event) pushUnique(p.common_triggers, ev.trigger_event);
      ev.body_cue.forEach((b) => pushUnique(p.common_body_cues, b));
      if (ev.user_words_raw) pushUnique(p.common_user_phrases, ev.user_words_raw);
      p.memory_summary = ev.memory_note;
    }

    p.updated_at = nowIso();
    await emotionProgressRepo.save(p).catch(() => {});
    set((s) => ({ progress: { ...s.progress, [fam]: p } }));
  },

  dismissUnlock: () => set({ unlock: null }),
  dismissSafety: () => set((s) => ({ safety: { ...s.safety, visible: false } })),
  dismissWeekly: () => set({ weekly: null }),

  confirmMemoryDraft: async () => {
    const draft = get().memoryDraft;
    if (!draft) return;
    const card: MemoryCard = { ...draft, confirmation_status: 'user_confirmed', updated_at: nowIso() };
    set((s) => ({ memoryDraft: null, memoryCards: [...s.memoryCards, card] }));
    await memoryCardsRepo.save(card).catch(() => {});
  },

  editMemoryDraft: async (summary) => {
    const draft = get().memoryDraft;
    const clean = summary.trim();
    if (!draft || !clean) return;
    const card: MemoryCard = { ...draft, summary: clean, confirmation_status: 'user_edited', updated_at: nowIso() };
    set((s) => ({ memoryDraft: null, memoryCards: [...s.memoryCards, card] }));
    await memoryCardsRepo.save(card).catch(() => {});
  },

  rejectMemoryDraft: () => set({ memoryDraft: null }),

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
      memoryCards: [],
      memoryDraft: null,
      weekly: null,
      userName: '',
      remindersEnabled: false,
    });
  },
}));
