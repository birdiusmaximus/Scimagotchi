/**
 * Native fallback for the web speech-to-text hook. There's no built-in on-device
 * speech recogniser, so this reports `supported: false` and the mic UI hides itself
 * until a native speech module (e.g. expo-speech-recognition + a dev build) is added.
 * The web implementation lives in useSpeechRecognition.web.ts.
 */
export interface SpeechRecognizer {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useSpeechRecognition(_opts: { onResult: (text: string, isFinal: boolean) => void; lang?: string }): SpeechRecognizer {
  return {
    supported: false,
    listening: false,
    error: null,
    start: () => {},
    stop: () => {},
    toggle: () => {},
  };
}
