import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Speech-to-text via the browser Web Speech API (web only). Tap to start, speak,
 * and the live transcript streams out through `onResult`; tap again (or a natural
 * pause/`stop()`) ends it with the final text. No dependency, no key — it runs in
 * the browser. Needs a secure context (HTTPS or localhost) and mic permission.
 *
 * Native has its own stub (useSpeechRecognition.ts) that reports unsupported until
 * a native speech module is added; the consumer just checks `supported`.
 */
export interface SpeechRecognizer {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

type Opts = { onResult: (text: string, isFinal: boolean) => void; lang?: string };

export function useSpeechRecognition({ onResult, lang }: Opts): SpeechRecognizer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR: any =
    typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const supported = !!SR;

  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const finalRef = useRef('');
  // Keep the latest callback without restarting recognition.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* not running */
    }
  }, []);

  const start = useCallback(() => {
    if (!SR || recRef.current) return;
    setError(null);
    finalRef.current = '';
    const rec = new SR();
    rec.lang = lang || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += t;
        else interim += t;
      }
      onResultRef.current((finalRef.current + interim).replace(/\s+/g, ' ').trimStart(), false);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      setError(String(e?.error || 'speech-error'));
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const finalText = finalRef.current.replace(/\s+/g, ' ').trim();
      if (finalText) onResultRef.current(finalText, true);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      recRef.current = null;
      setError(String((e as Error)?.message || e));
    }
  }, [SR, lang]);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  // Abort cleanly if the component unmounts mid-listen.
  useEffect(
    () => () => {
      try {
        recRef.current?.abort?.();
      } catch {
        /* noop */
      }
    },
    [],
  );

  return { supported, listening, error, start, stop, toggle };
}
