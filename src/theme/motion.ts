/**
 * Shared entrance animations for screens, panels and lists. One cohesive language
 * (a soft fade with a gentle settle) so the whole app feels like it composes itself
 * into place, rather than a scatter of different effects. Built on Reanimated's
 * layout animations with the remotion-skill ease-out curve, and they respect the
 * OS "reduce motion" setting.
 */

import { Easing, FadeIn, FadeInDown, ReduceMotion } from 'react-native-reanimated';

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** A panel/card settling into place: fade + a small drop from above. */
export const enterPanel = (delay = 0) =>
  FadeInDown.delay(delay).duration(460).easing(EASE_OUT).reduceMotion(ReduceMotion.System);

/** One row in a staggered list — pass the index so items cascade in. */
export const enterItem = (index = 0, step = 55, base = 40) =>
  FadeInDown.delay(base + index * step)
    .duration(420)
    .easing(EASE_OUT)
    .reduceMotion(ReduceMotion.System);

/** A quiet fade, for things that should appear without movement. */
export const enterFade = (delay = 0) => FadeIn.delay(delay).duration(380).reduceMotion(ReduceMotion.System);
