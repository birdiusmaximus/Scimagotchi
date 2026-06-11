import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the OS "reduce motion" accessibility setting (and updates if it changes),
 * so animations can soften or hold still for people who prefer less movement.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => active && setReduced(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduced(!!v));
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}
