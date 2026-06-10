/**
 * AI service abstraction (brief §13.2). The app talks to this, never to a
 * provider. It routes each turn to OpenAI — via the local dev proxy if
 * EXPO_PUBLIC_AI_PROXY_URL is set (works on web + native, key stays server-side),
 * otherwise directly with a device key on native — and falls back to the
 * deterministic on-device engine on any failure, on web with no proxy (CORS), or
 * when no key/proxy is configured. Safety classification is always local.
 */

import { Platform } from 'react-native';

import { nextTurn, type CompanionInput, type CompanionTurn } from '@/services/ai/companionEngine';
import { getApiKey, getModel } from '@/services/ai/keyStore';
import { openaiGenerateTurn } from '@/services/ai/openaiClient';
import { classifySafety, type SafetyResult } from '@/services/ai/safetyClassifier';

export type { CompanionInput };

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL || null;

export interface AiService {
  generateTurn(input: CompanionInput): Promise<CompanionTurn>;
  classifySafety(text: string): SafetyResult;
}

/** Whether cloud AI is usable here. */
export async function cloudAvailable(): Promise<boolean> {
  if (PROXY_URL) return true; // proxy holds the key server-side; works on web too
  if (Platform.OS === 'web') return false; // direct browser → OpenAI is blocked by CORS
  return !!(await getApiKey().catch(() => null));
}

export const ai: AiService = {
  async generateTurn(input) {
    try {
      const proxyUrl = PROXY_URL;
      const apiKey = proxyUrl ? null : Platform.OS !== 'web' ? await getApiKey().catch(() => null) : null;
      if (proxyUrl || apiKey) {
        const model = await getModel().catch(() => 'gpt-5.4-mini');
        return await openaiGenerateTurn(input, { proxyUrl, apiKey, model });
      }
    } catch (e) {
      console.warn('[scimagotchi] OpenAI turn failed, using local engine:', e);
    }
    return nextTurn(input.userText, input.prevEvent, input.conversationId);
  },
  classifySafety,
};
