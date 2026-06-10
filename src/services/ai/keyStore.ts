/**
 * Secure storage for the OpenAI API key + model (native). The key is entered in
 * Settings and kept in the device keychain via expo-secure-store — never in the
 * codebase or bundle. An `EXPO_PUBLIC_OPENAI_API_KEY` env var overrides it for dev.
 * Web uses `keyStore.web.ts` (localStorage) instead.
 */

import * as SecureStore from 'expo-secure-store';

const KEY = 'scima_openai_key';
const MODEL = 'scima_openai_model';
export const DEFAULT_MODEL = 'gpt-5.4-mini';

export async function getApiKey(): Promise<string | null> {
  const env = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (env) return env;
  try {
    return (await SecureStore.getItemAsync(KEY)) || null;
  } catch {
    return null;
  }
}

export async function setApiKey(key: string): Promise<void> {
  const v = key.trim();
  try {
    if (v) await SecureStore.setItemAsync(KEY, v);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}

export async function getModel(): Promise<string> {
  const env = process.env.EXPO_PUBLIC_OPENAI_MODEL;
  if (env) return env;
  try {
    return (await SecureStore.getItemAsync(MODEL)) || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export async function setModel(model: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(MODEL, model.trim() || DEFAULT_MODEL);
  } catch {
    // ignore
  }
}
