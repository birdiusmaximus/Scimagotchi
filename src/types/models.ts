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

export type UnlockStage = 'noticed' | 'named' | 'shaped' | 'understood' | 'deepened';
export type Valence = 'negative' | 'neutral' | 'positive' | 'mixed';
export type Activation = 'low' | 'medium' | 'high';
export type ControlPower = 'low' | 'medium' | 'high' | 'unknown';
export type EmotionStatus = 'confirmed' | 'candidate' | 'unclear' | 'none';
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
  unlock_stage: UnlockStage;
  memory_note: string | null;
  do_not_store: 0 | 1;
  safety_flag: SafetyFlag;
}

export interface EmotionProgress {
  id: string; // equals the emotion_family id (one row per family)
  emotion_family: EmotionFamilyId;
  current_stage: UnlockStage;
  introduced_at: string;
  first_shape_at?: string | null;
  deepened_at?: string | null;
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
  emotions_introduced: EmotionFamilyId[];
  emotions_first_shape: EmotionFamilyId[];
  repeated_themes: string[];
  key_user_phrases: string[];
  companion_summary: string;
  pdf_export_path?: string | null;
}

export interface AppSettings {
  id: string; // always 'app'
  user_name?: string | null;
  last_weekly_week?: string | null;
  age_confirmed_18?: 0 | 1;
  reminders_enabled?: 0 | 1;
  inactivity_days_before_reminder?: number;
  created_at?: string;
  updated_at?: string;
}
