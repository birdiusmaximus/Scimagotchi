import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Live talk (web) — a hands-free conversation loop on top of the browser Web Speech API.
 * Tap start, and it transcribes continuously; after a ~1.5s pause it treats what you said
 * as one utterance and hands it to `onUtterance` (the caller sends it to the companion),
 * then keeps listening for the next thing you say. iOS Safari ends a session after each
 * phrase, so we restart automatically to stay continuous.
 *
 * Web only. The native stub (useLiveTalk.ts) reports unsupported until an on-device speech
 * module (e.g. expo-speech-recognition) is wired — where this will be far more reliable.
 */
export interface LiveTalk {
  supported: boolean;
  live: boolean;
  /** The running transcript of the current utterance, for showing in the field. */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

type Opts = { onUtterance: (text: string) => void; silenceMs?: number; lang?: string };

// Errors that mean we can't continue (permission/hardware) — stop instead of restart-looping.
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

export function useLiveTalk({ onUtterance, silenceMs = 1500, lang }: Opts): LiveTalk {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR: any =
    typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const supported = !!SR;

  const [live, setLive] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const liveRef = useRef(false); // authoritative "should be listening" flag
  const bufferRef = useRef(''); // finalized text of the current utterance
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardRef = useRef(0); // debounce rapid onend→restart loops
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // A pause has elapsed (or the session ended): ship the buffered utterance and reset.
  const flush = useCallback(() => {
    clearTimer();
    const text = bufferRef.current.replace(/\s+/g, ' ').trim();
    bufferRef.current = '';
    setInterim('');
    if (text) onUtteranceRef.current(text);
  }, []);

  // Start one recognition session; auto-restarts (via onend) while liveRef is true.
  const spin = useCallback(() => {
    if (!SR || !liveRef.current || recRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR();
    rec.lang = lang || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let partial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) bufferRef.current += t + ' ';
        else partial += t;
      }
      setInterim((bufferRef.current + partial).replace(/\s+/g, ' ').trimStart());
      // Every bit of speech resets the pause clock; when it lapses we send the utterance.
      clearTimer();
      timerRef.current = setTimeout(flush, silenceMs);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      const err = String(e?.error || 'speech-error');
      if (FATAL.has(err)) {
        liveRef.current = false;
        setLive(false);
        clearTimer();
        setError(err);
      }
      // 'no-speech' / 'aborted' are normal in a long session — onend will restart us.
    };
    rec.onend = () => {
      recRef.current = null;
      if (!liveRef.current) return;
      const now = Date.now();
      const delay = now - guardRef.current < 500 ? 500 : 0;
      guardRef.current = now;
      setTimeout(() => {
        if (liveRef.current) spin();
      }, delay);
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      recRef.current = null;
    }
  }, [SR, lang, silenceMs, flush]);

  const start = useCallback(() => {
    if (!SR || liveRef.current) return;
    setError(null);
    bufferRef.current = '';
    setInterim('');
    liveRef.current = true;
    setLive(true);
    spin();
  }, [SR, spin]);

  const stop = useCallback(() => {
    liveRef.current = false;
    setLive(false);
    flush(); // send whatever was buffered when the user ends the session
    try {
      recRef.current?.stop();
    } catch {
      /* not running */
    }
    recRef.current = null;
  }, [flush]);

  const toggle = useCallback(() => {
    (liveRef.current ? stop : start)();
  }, [start, stop]);

  // Abort cleanly if the component unmounts mid-session.
  useEffect(
    () => () => {
      liveRef.current = false;
      clearTimer();
      try {
        recRef.current?.abort?.();
      } catch {
        /* noop */
      }
    },
    [],
  );

  return { supported, live, interim, error, start, stop, toggle };
}
