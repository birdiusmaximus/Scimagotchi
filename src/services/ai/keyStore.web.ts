/**
 * Web fallback for the API key store (localStorage). Browsers can't call OpenAI
 * directly (CORS), so the web build uses the local engine regardless — this exists
 * so the Settings field works and to keep expo-secure-store out of the web bundle.
 */

const KEY = 'scima:openai_key';
const MODEL = 'scima:openai_model';
export const DEFAULT_MODEL = 'gpt-5.4-mini';

const ls = (): Storage | null => {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
};

export async function getApiKey(): Promise<string | null> {
  const env = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (env) return env;
  return ls()?.getItem(KEY) || null;
}

export async function setApiKey(key: string): Promise<void> {
  const v = key.trim();
  const s = ls();
  if (!s) return;
  if (v) s.setItem(KEY, v);
  else s.removeItem(KEY);
}

export async function getModel(): Promise<string> {
  const env = process.env.EXPO_PUBLIC_OPENAI_MODEL;
  if (env) return env;
  return ls()?.getItem(MODEL) || DEFAULT_MODEL;
}

export async function setModel(model: string): Promise<void> {
  ls()?.setItem(MODEL, model.trim() || DEFAULT_MODEL);
}
