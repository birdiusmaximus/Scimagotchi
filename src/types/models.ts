/**
 * Local data models for Scimagotchi v0.1. Field names mirror the SQLite schema
 * in the build brief (§12.4) so the persistence layer can grow into typed
 * columns later without changing callers.
 */

export type EmotionFamilyId =
  | 'joy'
  | 'calm'
  | 'fear'
  | 'pressure'
  | 'anger'
  | 'sadness'
  | 'hurt'
  | 'shame'
  | 'flat';

/** Turn-level stage of the in-conversation walk (event.unlock_stage). */
export type UnlockStage = 'noticed' | 'named' | 'shaped' | 'understood' | 'deepened';

/** Per-family progression across sessions (engine brief §13.2). */
export type EmotionProgressStage =
  | 'unseen'
  | 'noticed'
  | 'named'
  | 'first_shape'
  | 'rooted'
  | 'distinguished'
  | 'returning'
  | 'deepened';

/** User emotional capabilities the engine tracks evidence for (engine brief §13.1). */
export type EmotionalCapability = 'noticing' | 'naming' | 'differentiating' | 'contextualising' | 'integrating';
export type Valence = 'negative' | 'neutral' | 'positive' | 'mixed';
export type Activation = 'low' | 'medium' | 'high';
export type ControlPower = 'low' | 'medium' | 'high' | 'unknown';
export type EmotionStatus = 'confirmed' | 'candidate' | 'unclear' | 'none';
/** Where the current emotion label came from (engine brief §8.1 separation). */
export type LabelSource = 'user_stated' | 'user_confirmed' | 'companion_hypothesis';
/** How two strands of a mixed feeling relate (engine brief §9.1). */
export type MixedRelation = 'simultaneous' | 'oscillating' | 'foreground_background' | 'protective_layer' | 'unclear';

/** One strand of a (possibly mixed) feeling (engine brief §8.3). */
export interface EmotionStrand {
  family: EmotionFamilyId;
  shade: string | null;
  salience: 'foreground' | 'background' | 'equal' | 'unclear';
  source: LabelSource;
}
export type Confidence = 'high' | 'medium' | 'low' | 'unknown';
export type SafetyFlag = 'none' | 'mild_concern' | 'urgent_review';
export type MessageRole = 'user' | 'companion' | 'system';

/** Orb colour states for v0.1 (a calm default + the worked Anger tone). */
export type OrbTone = 'calm' | 'anger';

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  title?: string | null;
  status: 'active' | 'saved' | 'archived';
  primary_emotion_family?: EmotionFamilyId | null;
  primary_emotion_shade?: string | null;
  safety_level: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  ai_generated: 0 | 1;
  safety_flag: SafetyFlag;
}

export interface EmotionEvent {
  id: string;
  conversation_id: string;
  timestamp: string;
  user_words_raw: string;
  emotion_status: EmotionStatus;
  emotion_family: EmotionFamilyId | null;
  emotion_shade: string | null;
  secondary_emotions: string[];
  valence: Valence;
  activation: Activation;
  control_power: ControlPower;
  intensity: string | null;
  trigger_event: string | null;
  appraisal_thought: string | null;
  body_cue: string[];
  behaviour_action: string[];
  coping_response: string[];
  outcome: string | null;
  social_context: string[];
  need_value: string[];
  confidence_level: Confidence;
  evidence_basis: string[];
  user_confirmation: 'yes' | 'no' | 'partial' | 'unknown';
  /** Provenance of the current label — hypotheses must never unlock (brief §8.1, §13.4). */
  label_source: LabelSource | null;
  /** Shades the user has explicitly rejected this conversation — they block unlock and re-proposal. */
  user_rejected_shades: string[];
  /** How co-present feelings relate, when the user has shown more than one strand. */
  mixed_relation: MixedRelation | null;
  /** One entry per co-present feeling when more than one is in play (else empty). */
  strands: EmotionStrand[];
  /** 1 once the mixed structure is user-confirmed per §9.3 — only then may it be saved/counted. */
  mixed_confirmed: 0 | 1;
  unlock_stage: UnlockStage;
  memory_note: string | null;
  do_not_store: 0 | 1;
  safety_flag: SafetyFlag;
}

export interface EmotionProgress {
  id: string; // equals the emotion_family id (one row per family)
  emotion_family: EmotionFamilyId;
  current_stage: EmotionProgressStage;
  introduced_at: string;
  first_shape_at?: string | null;
  rooted_at?: string | null;
  distinguished_at?: string | null;
  returning_at?: string | null;
  deepened_at?: string | null;
  /** How many separate conversations this family has shown up in (drives Returning). */
  return_count: number;
  /** The last conversation that touched this family (so returns are counted once per convo). */
  last_conversation_id: string | null;
  confirmed_shades: string[];
  common_triggers: string[];
  common_body_cues: string[];
  common_user_phrases: string[];
  memory_summary: string | null;
  updated_at: string;
}

export interface SafetyEvent {
  id: string;
  conversation_id?: string | null;
  created_at: string;
  level: number;
  category: string;
  trigger_excerpt: string;
  resources_shown: string[];
  dismissed_at?: string | null;
  retriggered: 0 | 1;
}

export interface WeeklySummary {
  id: string; // week_YYYY-MM-DD (Monday)
  week_start: string;
  week_end: string;
  generated_at: string;
  checkin_count: number;
  /** How many memories the user chose to keep this week — what the summary is built on (§17.1). */
  saved_count: number;
  emotions_introduced: EmotionFamilyId[];
  emotions_first_shape: EmotionFamilyId[];
  /** Families that reached a returning/deepened pattern this week (§13.5, §17.2). */
  deepened_patterns: EmotionFamilyId[];
  repeated_themes: string[];
  key_user_phrases: string[];
  /** One tentative thing the companion learned, in the user's framing (§14). */
  companion_learning_statement: string | null;
  companion_summary: string;
  /** Honest scope note — never present sparse data as if complete (§17.1). */
  caveat: string;
  pdf_export_path?: string | null;
}

/** What kind of thing a memory card records (engine brief §12.2). */
export type MemoryCardType =
  | 'emotional_pattern'
  | 'body_cue_pattern'
  | 'trigger_pattern'
  | 'shade_distinction'
  | 'mixed_pattern'
  | 'repair_instruction'
  | 'support_preference'
  | 'language_preference'
  | 'do_not_suggest';

export type MemoryConfirmation = 'draft' | 'user_confirmed' | 'user_edited' | 'user_rejected' | 'expired';
export type MemoryRetention = 'session_only' | 'expires' | 'persistent_until_deleted';

/**
 * One user-owned memory (engine brief §12). Cards are DRAFTED by the engine but
 * become durable only through explicit user confirmation — never silently.
 */
export interface MemoryCard {
  id: string;
  created_at: string;
  updated_at: string;
  source_conversation_id: string | null;
  type: MemoryCardType;
  /** The memory itself, in user-facing language (no names/locations/third parties). */
  summary: string;
  /** The user's own phrases backing it. */
  user_words: string[];
  emotion_family: EmotionFamilyId | null;
  confirmation_status: MemoryConfirmation;
  sensitivity: 'low' | 'moderate' | 'high';
  retention: MemoryRetention;
  expires_at: string | null;
  muted: 0 | 1;
}

export interface AppSettings {
  id: string; // always 'app'
  user_name?: string | null;
  last_weekly_week?: string | null;
  age_confirmed_18?: 0 | 1;
  reminders_enabled?: 0 | 1;
  inactivity_days_before_reminder?: number;
  /** Evidence counters for the user's emotional capabilities (engine brief §13.1). */
  capabilities?: Partial<Record<EmotionalCapability, number>>;
  created_at?: string;
  updated_at?: string;
}
