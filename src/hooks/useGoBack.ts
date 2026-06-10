import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Back navigation that always does something. `router.back()` no-ops when there
 * is no history (a deep link, a reload, or the app's first screen), which leaves
 * the header chevron dead. This falls back to Home in that case so the button is
 * never a dead end.
 */
export function useGoBack(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
}
