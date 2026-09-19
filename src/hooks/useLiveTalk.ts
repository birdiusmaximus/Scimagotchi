/**
 * Live talk — native stub. There's no on-device speech module wired yet, so this reports
 * unsupported and the mic falls back to a no-op (the consumer checks `supported`). Add
 * `expo-speech-recognition` (Apple's SFSpeechRecognizer / Android SpeechRecognizer) to make
 * live talk real on device, where it will be instant, reliable, and private. The web build
 * uses useLiveTalk.web.ts.
 */
export interface LiveTalk {
  supported: boolean;
  live: boolean;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

type Opts = { onUtterance: (text: string) => void; silenceMs?: number; lang?: string };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useLiveTalk(_opts: Opts): LiveTalk {
  return {
    supported: false,
    live: false,
    interim: '',
    error: null,
    start: () => {},
    stop: () => {},
    toggle: () => {},
  };
}
