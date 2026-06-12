import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { FAMILY_COLORS } from '@/data/emotionMaps';
import {
  type CompanionGesture,
  durationFor,
  MOTION_CONFIG,
  poseFor,
  POSE_TARGETS,
  resolveMotion,
} from '@/services/ai/companionPose';
import { EMOTION_BEATS, SEQ_SPRINGS } from '@/services/ai/emotionAnimations';
import type { CompanionVisualState } from '@/services/ai/companionVisualState';
import { expressionFor } from '@/services/ai/orbExpression';
import { gradients } from '@/theme/tokens';
import type { EmotionFamilyId } from '@/types/models';
import { withAlpha } from '@/utils/color';

// Production easing curves (from the remotion best-practices skill): a crisp
// ease-out for settling into a pose, a balanced ease-in-out for calm loops.
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN_OUT = Easing.bezier(0.45, 0, 0.55, 1);
// A gentle spring for arm follow-through: light mass, mild overshoot, soft settle.
const ARM_SPRING = { damping: 13, stiffness: 95, mass: 0.9 } as const;
// A livelier spring for the wave / anticipation gestures (a touch more bounce).
const OPEN_SPRING = { damping: 11, stiffness: 110, mass: 0.85 } as const;
// A laggier spring for the arms trailing the body while it is dragged about.
const TRAIL_SPRING = { damping: 13, stiffness: 70, mass: 1.1 } as const;

type Props = {
  size?: number;
  /** Subtly tints the orb's hue toward this emotion (not a full colour change). */
  family?: EmotionFamilyId | null;
  /** Foreground + (optional) background strand hues for mixed states (overrides family). */
  tintFamilies?: EmotionFamilyId[];
  /** How fully the emotion hue fills the orb (0..1). Driven by how well the feeling is
   *  understood so far, so colour builds gradually as a feeling unlocks. Default 1. */
  tintLevel?: number;
  /** Families explored TODAY — rendered as very subtle hue hints on the orb's surface. */
  dailyHues?: EmotionFamilyId[];
  /** What the orb should communicate (engine brief §18); ambience only, never reward. */
  visual?: CompanionVisualState;
  /** A transient tapped-chip gesture that briefly overrides the ambient arm pose
   * ("stay with it" / "not quite" / "done" / "memory saved" / greeting). Bump `key`
   * to fire it; `hold: true` sustains it (e.g. listening) until the prop clears. */
  gesture?: { key: number; state: CompanionGesture; hold?: boolean } | null;
  /** Force reduced motion. When undefined, the OS "reduce motion" setting is used. */
  reducedMotion?: boolean;
  /** Play a learned emotion's embodied animation (home double-tap cycle). Bump `key`
   * to trigger; the orb runs the family's 3-act sequence, then returns to its pose. */
  playEmotion?: { key: number; family: EmotionFamilyId } | null;
  /** Fired when the companion is double-tapped (home uses it to cycle emotions). */
  onDoubleTap?: () => void;
  /** Enable touch reactions: eyes follow the finger, poke recoil, pet to close. */
  interactive?: boolean;
  /** Bump `key` (with a sentence count) to make the orb react as it "speaks". */
  speak?: { key: number; sentences: number };
  /** Bump `key` to make the companion raise its eyes, lift a hand, and wave back. */
  wave?: { key: number } | null;
  /** Bump `key` to play the "new conversation" anticipation: arms swing wide, then settle. */
  anticipate?: { key: number } | null;
  /** One-shot slow colour fade when returning home from a chat: start at the feeling's
   *  hue (fromLevel) and ease gently back to none. Bump `key` to play. */
  homecomingFade?: { family: EmotionFamilyId; fromLevel: number; key: number } | null;
  /** How far (× body radius) the companion senses the cursor on web. Larger = reacts
   *  from further away. Only used when `interactive`. */
  reach?: number;
  style?: ViewStyle;
};

const BASE_GLOW = '0px 0px 44px 6px rgba(124,92,242,0.42), 0px 0px 96px 20px rgba(110,124,242,0.26), 0px 14px 30px rgba(70,70,140,0.26)';
// Softer glow for the small satellite arm orbs.
const ARM_GLOW = '0px 0px 16px 3px rgba(124,92,242,0.34), 0px 4px 10px rgba(70,70,140,0.22)';

// Stable references for the LinearGradient props. The orb re-renders every frame
// (ambient Reanimated animation on web); passing fresh array/object literals would
// make NativeLinearGradient re-process + setState mid-render on each frame.
const ORB_GRADIENT_START = { x: 0.18, y: 0.08 };
const ORB_GRADIENT_END = { x: 0.82, y: 0.96 };
const SHEEN_COLORS = ['transparent', 'transparent', 'rgba(226,239,255,0.62)'] as const;
const SHEEN_START = { x: 0.5, y: 0.28 };
const SHEEN_END = { x: 0.44, y: 1 };

/**
 * The orb's static gradient layers, isolated behind React.memo. On web,
 * expo-linear-gradient (NativeLinearGradient) writes internal state during its
 * render; the orb re-renders constantly (ambient animation, tint, speak), so
 * without this memo those writes would loop render→setState→render and hang the
 * page. With a stable `kind` prop the gradient renders exactly once.
 */
const OrbGradientLayer = memo(function OrbGradientLayer({ kind }: { kind: 'base' | 'sheen' }) {
  return kind === 'base' ? (
    <LinearGradient
      colors={gradients.orbCalm}
      start={ORB_GRADIENT_START}
      end={ORB_GRADIENT_END}
      style={StyleSheet.absoluteFill}
    />
  ) : (
    <LinearGradient colors={SHEEN_COLORS} start={SHEEN_START} end={SHEEN_END} style={StyleSheet.absoluteFill} />
  );
});

/**
 * The emotion hue, rendered as its own gradient (lighter toward the highlight, fuller
 * toward the base) so the orb clearly BECOMES the feeling's colour — joy gold, calm
 * teal, sadness blue — instead of a muddy flat wash over the violet. Memoised by
 * colour so it renders once per emotion, not every animation frame. The white
 * sheen/highlight layered on top keep it glossy. Colours mirror the Patterns screen.
 */
const EmotionTintLayer = memo(function EmotionTintLayer({ color }: { color: string }) {
  return (
    <LinearGradient
      colors={[withAlpha(color, 0.7), withAlpha(color, 0.9), withAlpha(color, 0.99)]}
      start={ORB_GRADIENT_START}
      end={ORB_GRADIENT_END}
      style={StyleSheet.absoluteFill}
    />
  );
});

/**
 * The SECOND strand of a mixed feeling, bloomed from the lower-right rather than
 * washed flat over the whole orb — so two feelings read as two hues meeting, not a
 * muddy grey blend. Renders nothing when there is no second family.
 */
const SecondTintLayer = memo(function SecondTintLayer({ color }: { color: string }) {
  if (!color || color === 'transparent') return null;
  return (
    <LinearGradient
      colors={['transparent', 'transparent', withAlpha(color, 0.92)]}
      locations={[0, 0.46, 1]}
      start={{ x: 0.12, y: 0.1 }}
      end={{ x: 0.94, y: 0.96 }}
      style={StyleSheet.absoluteFill}
    />
  );
});

// Up to four edges for the daily-hue blooms, so each day's feelings creep in from a
// different corner as faint, separate hints rather than one muddy wash.
const HUE_CORNERS = [
  { start: { x: 0.12, y: 0.12 }, end: { x: 0.92, y: 0.92 } },
  { start: { x: 0.88, y: 0.1 }, end: { x: 0.12, y: 0.9 } },
  { start: { x: 0.1, y: 0.9 }, end: { x: 0.9, y: 0.12 } },
  { start: { x: 0.9, y: 0.88 }, end: { x: 0.1, y: 0.12 } },
] as const;

/**
 * Very subtle hints of the feelings explored TODAY, bloomed faintly from the orb's
 * edges — the companion quietly "carries" the day's feelings near its surface until
 * midnight. Memoised by a stable colour key so it renders once per set, not per frame.
 */
const DailyHuesLayer = memo(function DailyHuesLayer({ colorsKey }: { colorsKey: string }) {
  if (!colorsKey) return null;
  return (
    <>
      {colorsKey.split('|').slice(0, 4).map((c, i) => (
        <LinearGradient
          key={i}
          colors={['transparent', 'transparent', withAlpha(c, 0.18)]}
          locations={[0, 0.66, 1]}
          start={HUE_CORNERS[i % 4].start}
          end={HUE_CORNERS[i % 4].end}
          style={StyleSheet.absoluteFill}
        />
      ))}
    </>
  );
});

/**
 * The companion: a glowing gradient orb with two soft eyes. Ambient float/breathe/
 * blink; when `interactive`, the eyes + glossy reflection follow the finger, a poke
 * bounces it away, and a long press closes its eyes (petting). A faint `family`
 * tint shifts its hue with the emotion, and `speak` nudges it once per sentence so
 * it feels like it's reacting as it talks.
 */
export function CompanionOrb({
  size = 156,
  family = null,
  tintFamilies,
  tintLevel = 1,
  dailyHues,
  visual = 'idle_calm',
  gesture = null,
  reducedMotion,
  playEmotion = null,
  onDoubleTap,
  interactive = false,
  speak,
  wave = null,
  anticipate = null,
  homecomingFade = null,
  reach = 1.9,
  style,
}: Props) {
  const floatY = useSharedValue(0);
  const breathe = useSharedValue(0);
  const aura = useSharedValue(0);
  const blink = useSharedValue(1);

  const lookX = useSharedValue(0);
  const lookY = useSharedValue(0);
  const petting = useSharedValue(0);
  const recoilX = useSharedValue(0);
  const recoilY = useSharedValue(0);
  const poke = useSharedValue(0);
  const glow = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const tint = useSharedValue(0); // emotion hue strength
  const speakV = useSharedValue(0); // per-sentence reaction
  const tintFactor = useSharedValue(1); // halved when the feeling is still uncertain
  const recede = useSharedValue(0); // safety_receded: companion steps back
  const secondTint = useSharedValue(0); // background strand hue (mixed states)

  // Per-emotion expression (§6.2/6.3): the orb moves like the feeling.
  const emoSink = useSharedValue(0); // -1 lift .. +1 sink
  const emoEnergy = useSharedValue(1); // float/breathe amplitude
  const emoTremor = useSharedValue(0); // fear: fine tremble amplitude
  const emoPulse = useSharedValue(0); // anger/pressure: pulse amplitude
  const emoContract = useSharedValue(0); // shame/hurt/flat: inward draw
  const tremorOsc = useSharedValue(0); // fast oscillator for the tremble
  const pulseOsc = useSharedValue(0); // slower oscillator for the pulse
  const drift = useSharedValue(0.5); // slow idle oscillator for independent arm drift

  // ── Satellite arm orbs + pose (native-animation brief) ─────────────────────
  // Each arm tracks a pose target (px = fraction × size); the body leads, the arms
  // lag and settle, the glow follows. Initialised to the calm pose so they don't
  // spring in from the centre on mount.
  const C = POSE_TARGETS.calm;
  const aLx = useSharedValue(C.leftArm.x * size);
  const aLy = useSharedValue(C.leftArm.y * size);
  const aLs = useSharedValue(C.leftArm.scale);
  const aLr = useSharedValue(C.leftArm.rotate);
  const aLo = useSharedValue(C.leftArm.opacity);
  const aRx = useSharedValue(C.rightArm.x * size);
  const aRy = useSharedValue(C.rightArm.y * size);
  const aRs = useSharedValue(C.rightArm.scale);
  const aRr = useSharedValue(C.rightArm.rotate);
  const aRo = useSharedValue(C.rightArm.opacity);
  const pBy = useSharedValue(0); // body pose translateY add (px)
  const pBs = useSharedValue(0); // body pose scale add
  const pBr = useSharedValue(0); // body pose rotate (deg)
  const pGs = useSharedValue(C.glow.scale); // glow pose scale
  const pGo = useSharedValue(C.glow.opacity); // glow pose opacity

  // The outer wrap's DOM node (web) — used to measure the orb centre so the eyes can
  // track the cursor from across the screen, not just inside the orb's box.
  const wrapRef = useRef<View>(null);

  // Reduced motion: explicit prop wins, else follow the OS accessibility setting.
  const [reduceMotionSys, setReduceMotionSys] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => active && setReduceMotionSys(!!v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduceMotionSys(!!v));
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);
  const rm = reducedMotion ?? reduceMotionSys;

  useEffect(() => {
    // Reduced motion: hold every idle loop near-neutral, no continuous animation.
    if (rm) {
      for (const v of [floatY, breathe, aura, blink, tremorOsc, pulseOsc, drift]) cancelAnimation(v);
      floatY.value = 0.5;
      breathe.value = 0;
      aura.value = 0.4;
      blink.value = 1;
      tremorOsc.value = 0.5;
      pulseOsc.value = 0.5;
      drift.value = 0.5;
      return;
    }
    floatY.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true);
    breathe.value = withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }), -1, true);
    aura.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true);
    blink.value = withRepeat(
      withSequence(withDelay(2800, withTiming(0.12, { duration: 90 })), withTiming(1, { duration: 150 })),
      -1,
    );
    // Always-running oscillators; their amplitude is gated by emoTremor/emoPulse,
    // so they cost nothing visually until a feeling calls for them.
    tremorOsc.value = withRepeat(withTiming(1, { duration: 110, easing: Easing.inOut(Easing.sin) }), -1, true);
    pulseOsc.value = withRepeat(withTiming(1, { duration: 640, easing: Easing.inOut(Easing.sin) }), -1, true);
    // Slow idle drift for the arms (a different period from breathe so they drift
    // independently of each other and of the body).
    drift.value = withRepeat(withTiming(1, { duration: 5200, easing: EASE_IN_OUT }), -1, true);
  }, [rm, floatY, breathe, aura, blink, tremorOsc, pulseOsc, drift]);

  const primaryFamily = tintFamilies?.[0] ?? family;
  const secondFamily = tintFamilies?.[1] ?? null;

  // Colour fills GRADUALLY and in step with how well the feeling is understood: a faint
  // shade when first noticed, fuller as it unlocks, full only when deepened (tintLevel).
  // The easing is slow so the hue never snaps on — true for a brand-new feeling and for
  // a familiar one returning, which both start subtle and deepen as the talk evolves.
  useEffect(() => {
    tint.value = withTiming(primaryFamily ? tintLevel : 0, { duration: 2600, easing: Easing.inOut(Easing.sin) });
    secondTint.value = withTiming(secondFamily ? tintLevel : 0, { duration: 2600, easing: Easing.inOut(Easing.sin) });
  }, [primaryFamily, secondFamily, tintLevel, tint, secondTint]);

  // Per-emotion expression (§6.2/6.3): ease the orb's motion toward the feeling.
  useEffect(() => {
    const e = expressionFor(primaryFamily, visual);
    const d = 700;
    emoSink.value = withTiming(e.sink, { duration: d, easing: Easing.inOut(Easing.sin) });
    emoEnergy.value = withTiming(e.energy, { duration: d, easing: Easing.inOut(Easing.sin) });
    emoTremor.value = withTiming(e.tremor, { duration: d });
    emoPulse.value = withTiming(e.pulse, { duration: d });
    emoContract.value = withTiming(e.contract, { duration: d });
  }, [primaryFamily, visual, emoSink, emoEnergy, emoTremor, emoPulse, emoContract]);

  // Visual state (engine brief §18): ambience shifts, never reward effects.
  useEffect(() => {
    tintFactor.value = withTiming(visual === 'uncertain' ? 0.5 : 1, { duration: 600 });
    recede.value = withTiming(visual === 'safety_receded' ? 1 : 0, { duration: 500, easing: Easing.inOut(Easing.sin) });
    if (visual === 'first_shape' || visual === 'returning_shape') {
      // A single stabilising glow as a shape lands / a familiar shape returns.
      glow.value = withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 1200 }));
    }
  }, [visual, tintFactor, recede, glow]);

  // While a learned-emotion sequence plays, the orb wears that feeling's colour.
  const [playColor, setPlayColor] = useState<string | null>(null);
  // While a homecoming fade runs, the orb wears the last chat's hue as it eases out.
  const [fadeColor, setFadeColor] = useState<string | null>(null);

  // ── Tapped-chip gesture: a transient pose that plays then reverts to ambient ─
  // (sustained when `hold`, e.g. listening while the input is focused).
  const [activeGesture, setActiveGesture] = useState<CompanionGesture | null>(null);
  useEffect(() => {
    if (!gesture || gesture.key === 0) {
      setActiveGesture(null);
      return;
    }
    setActiveGesture(gesture.state);
    if (gesture.hold) return; // held until the prop clears
    const t = setTimeout(() => setActiveGesture(null), durationFor(gesture.state) + 700);
    return () => clearTimeout(t);
  }, [gesture?.key, gesture?.state, gesture?.hold, gesture]);

  // ── Pose animation: body leads, arms lag + settle, glow follows (brief §5/§6) ─
  const motion = resolveMotion(visual, primaryFamily, activeGesture);
  useEffect(() => {
    const p = poseFor(motion);
    const dur = durationFor(motion);
    const lag = rm ? 0 : MOTION_CONFIG.armLagMs;
    const glowLag = rm ? 0 : MOTION_CONFIG.glowLagMs;
    // Body first.
    pBy.value = withTiming(p.body.y * size, { duration: rm ? 220 : dur, easing: EASE_OUT });
    pBs.value = withTiming(p.body.scale - 1, { duration: rm ? 220 : dur, easing: EASE_OUT });
    pBr.value = withTiming(rm ? 0 : p.body.rotate, { duration: rm ? 220 : dur, easing: EASE_OUT });
    // Arms lag, then settle with a gentle spring overshoot (reduced motion: a plain
    // short ease, no spring, no overshoot).
    const setArm = (
      sx: typeof aLx,
      sy: typeof aLy,
      ss: typeof aLs,
      sr: typeof aLr,
      so: typeof aLo,
      a: (typeof p)['leftArm'],
    ) => {
      if (rm) {
        sx.value = withTiming(a.x * size, { duration: 220, easing: EASE_OUT });
        sy.value = withTiming(a.y * size, { duration: 220, easing: EASE_OUT });
        ss.value = withTiming(a.scale, { duration: 220, easing: EASE_OUT });
        sr.value = withTiming(0, { duration: 220 });
        so.value = withTiming(a.opacity, { duration: 220 });
      } else {
        sx.value = withDelay(lag, withSpring(a.x * size, ARM_SPRING));
        sy.value = withDelay(lag, withSpring(a.y * size, ARM_SPRING));
        ss.value = withDelay(lag, withSpring(a.scale, ARM_SPRING));
        sr.value = withDelay(lag, withSpring(a.rotate, ARM_SPRING));
        so.value = withDelay(lag, withTiming(a.opacity, { duration: dur, easing: EASE_OUT }));
      }
    };
    setArm(aLx, aLy, aLs, aLr, aLo, p.leftArm);
    setArm(aRx, aRy, aRs, aRr, aRo, p.rightArm);
    // Glow follows the body.
    pGs.value = withDelay(glowLag, withTiming(p.glow.scale, { duration: (rm ? 220 : dur) + 100, easing: EASE_OUT }));
    pGo.value = withDelay(glowLag, withTiming(p.glow.opacity, { duration: (rm ? 220 : dur) + 100, easing: EASE_OUT }));
  }, [motion, size, rm, aLx, aLy, aLs, aLr, aLo, aRx, aRy, aRs, aRr, aRo, pBy, pBs, pBr, pGs, pGo]);

  // ── Learned-emotion sequence (animation brief): on a double-tap, run the family's
  // 3-act beat sequence on the body/arms/glow, wear its hue, then return to the
  // current ambient pose. Reduced motion plays a gentle hue + scale pulse instead.
  useEffect(() => {
    if (!playEmotion || playEmotion.key === 0) return;
    const fam = playEmotion.family;
    const beats = EMOTION_BEATS[fam];
    if (!beats?.length) return;
    setPlayColor(FAMILY_COLORS[fam]);
    const base = poseFor(motion); // where to return when the sequence ends

    if (rm) {
      // Gentle hue + scale swell, then a slow, soft return to normal.
      tint.value = withSequence(withTiming(0.85, { duration: 620, easing: EASE_IN_OUT }), withDelay(900, withTiming(0, { duration: 1200, easing: EASE_IN_OUT })));
      pBs.value = withSequence(withTiming(0.03, { duration: 620, easing: EASE_IN_OUT }), withDelay(900, withTiming(base.body.scale - 1, { duration: 900, easing: EASE_IN_OUT })));
      pGo.value = withSequence(withTiming(base.glow.opacity + 0.2, { duration: 620, easing: EASE_IN_OUT }), withDelay(900, withTiming(base.glow.opacity, { duration: 900, easing: EASE_IN_OUT })));
      const t = setTimeout(() => setPlayColor(null), 2900);
      return () => clearTimeout(t);
    }

    // Resolve carry-forward full poses (calm-relative), then a frame returning to base.
    const c = POSE_TARGETS.calm;
    let cur = { body: { ...c.body }, left: { ...c.leftArm }, right: { ...c.rightArm }, glow: { ...c.glow } };
    const frames = beats.map((bt) => {
      cur = {
        body: { ...cur.body, ...bt.body },
        left: { ...cur.left, ...bt.left },
        right: { ...cur.right, ...bt.right },
        glow: { ...cur.glow, ...bt.glow },
      };
      return { pose: cur, dur: bt.dur, spring: bt.spring };
    });
    frames.push({ pose: { body: base.body, left: base.leftArm, right: base.rightArm, glow: base.glow }, dur: 640, spring: 'soft' as const });

    const seg = (target: number, dur: number, spring?: string) =>
      spring ? withSpring(target, SEQ_SPRINGS[spring as keyof typeof SEQ_SPRINGS]) : withTiming(target, { duration: dur, easing: EASE_OUT });
    const build = (get: (pose: (typeof frames)[number]['pose']) => number) =>
      withSequence(...frames.map((f) => seg(get(f.pose), f.dur, f.spring)));

    for (const v of [pBy, pBs, pBr, aLx, aLy, aLs, aLr, aRx, aRy, aRs, aRr, pGs, pGo]) cancelAnimation(v);
    pBy.value = build((p) => p.body.y * size);
    pBs.value = build((p) => p.body.scale - 1);
    pBr.value = build((p) => p.body.rotate ?? 0);
    aLx.value = build((p) => p.left.x * size);
    aLy.value = build((p) => p.left.y * size);
    aLs.value = build((p) => p.left.scale ?? 1);
    aLr.value = build((p) => p.left.rotate ?? 0);
    aRx.value = build((p) => p.right.x * size);
    aRy.value = build((p) => p.right.y * size);
    aRs.value = build((p) => p.right.scale ?? 1);
    aRr.value = build((p) => p.right.rotate ?? 0);
    pGs.value = build((p) => p.glow.scale ?? 1);
    pGo.value = build((p) => p.glow.opacity ?? 0.55);

    // Hue: ease in gently to a soft peak, hold through the whole sequence (the spring
    // tails run past `total`), then return to normal slowly and gently AFTER the
    // animation has finished — never a snap back.
    const total = frames.reduce((s, f) => s + f.dur, 0);
    const peak = 0.9; // a little under full, so the colour shift stays soft
    const inDur = 760;
    const holdUntil = total + 500; // keep the hue while the spring tails settle
    const outDur = 1200;
    cancelAnimation(tint);
    tint.value = withSequence(
      withTiming(peak, { duration: inDur, easing: EASE_IN_OUT }),
      withDelay(Math.max(0, holdUntil - inDur), withTiming(0, { duration: outDur, easing: EASE_IN_OUT })),
    );
    const t = setTimeout(() => setPlayColor(null), holdUntil + outDur + 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playEmotion?.key]);

  // React once per sentence as the companion speaks.
  useEffect(() => {
    if (!speak || speak.key === 0) return;
    const n = Math.max(1, Math.min(4, speak.sentences));
    const steps: number[] = [];
    for (let i = 0; i < n; i++) {
      steps.push(withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) }));
      steps.push(withTiming(0, { duration: 250, easing: Easing.inOut(Easing.quad) }));
    }
    speakV.value = withSequence(...steps);
  }, [speak?.key, speak?.sentences, speakV]);

  // ── Wave back (home/chat double-tap): raise the eyes, lift the right hand, give a
  // few side-to-side waves, then let everything settle back to the ambient pose. ──
  useEffect(() => {
    if (!wave || wave.key === 0) return;
    const base = poseFor(motion);
    const upY = -0.36 * size;
    const outX = 0.6 * size;
    const swing = 0.16 * size;
    // 1) the eyes lift first
    cancelAnimation(lookY);
    lookY.value = withSequence(
      withTiming(-0.55, { duration: 220, easing: EASE_OUT }),
      withDelay(1000, withTiming(0, { duration: 460, easing: EASE_OUT })),
    );
    // 2) the right hand rises just after, waves a few times, then settles
    for (const v of [aRx, aRy, aRs, aRr]) cancelAnimation(v);
    aRy.value = withSequence(
      withDelay(170, withTiming(upY, { duration: 260, easing: EASE_OUT })),
      withDelay(760, withSpring(base.rightArm.y * size, ARM_SPRING)),
    );
    aRs.value = withSequence(
      withDelay(170, withTiming(1.07, { duration: 260, easing: EASE_OUT })),
      withDelay(760, withSpring(base.rightArm.scale, ARM_SPRING)),
    );
    aRr.value = withSequence(
      withDelay(170, withTiming(12, { duration: 240, easing: EASE_OUT })),
      withDelay(740, withSpring(base.rightArm.rotate, ARM_SPRING)),
    );
    aRx.value = withSequence(
      withDelay(170, withTiming(outX, { duration: 240, easing: EASE_OUT })),
      withTiming(outX + swing, { duration: 170, easing: EASE_IN_OUT }),
      withTiming(outX - swing * 0.35, { duration: 180, easing: EASE_IN_OUT }),
      withTiming(outX + swing, { duration: 170, easing: EASE_IN_OUT }),
      withTiming(outX, { duration: 160, easing: EASE_IN_OUT }),
      withSpring(base.rightArm.x * size, ARM_SPRING),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wave?.key]);

  // ── New-conversation anticipation: a tiny gather, then both arms swing WIDE and up
  // in welcome, then settle to the ambient pose. (Replaces the small arrival wave.) ─
  useEffect(() => {
    if (!anticipate || anticipate.key === 0) return;
    const base = poseFor(motion);
    const wideX = 0.95 * size;
    const openY = -0.04 * size;
    const gatherX = 0.24 * size;
    const gatherY = 0.46 * size;
    const hold = 560;
    for (const v of [aLx, aLy, aLs, aRx, aRy, aRs, pBy, pBs, lookY]) cancelAnimation(v);
    // Left arm: gather in, swing wide+up, settle.
    aLx.value = withSequence(withTiming(-gatherX, { duration: 180, easing: EASE_IN_OUT }), withSpring(-wideX, OPEN_SPRING), withDelay(hold, withSpring(base.leftArm.x * size, ARM_SPRING)));
    aLy.value = withSequence(withTiming(gatherY, { duration: 180, easing: EASE_IN_OUT }), withSpring(openY, OPEN_SPRING), withDelay(hold, withSpring(base.leftArm.y * size, ARM_SPRING)));
    aLs.value = withSequence(withTiming(0.95, { duration: 180 }), withSpring(1.08, OPEN_SPRING), withDelay(hold, withSpring(base.leftArm.scale, ARM_SPRING)));
    // Right arm mirrors it.
    aRx.value = withSequence(withTiming(gatherX, { duration: 180, easing: EASE_IN_OUT }), withSpring(wideX, OPEN_SPRING), withDelay(hold, withSpring(base.rightArm.x * size, ARM_SPRING)));
    aRy.value = withSequence(withTiming(gatherY, { duration: 180, easing: EASE_IN_OUT }), withSpring(openY, OPEN_SPRING), withDelay(hold, withSpring(base.rightArm.y * size, ARM_SPRING)));
    aRs.value = withSequence(withTiming(0.95, { duration: 180 }), withSpring(1.08, OPEN_SPRING), withDelay(hold, withSpring(base.rightArm.scale, ARM_SPRING)));
    // Body dips, lifts on the open, then settles.
    pBy.value = withSequence(withTiming(0.03 * size, { duration: 180 }), withSpring(-0.05 * size, OPEN_SPRING), withDelay(hold, withTiming(base.body.y * size, { duration: 520, easing: EASE_OUT })));
    pBs.value = withSequence(withTiming(-0.02, { duration: 180 }), withSpring(0.05, OPEN_SPRING), withDelay(hold, withTiming(base.body.scale - 1, { duration: 520, easing: EASE_OUT })));
    // Eyes open a touch upward, then return.
    lookY.value = withSequence(withTiming(-0.22, { duration: 320, easing: EASE_OUT }), withDelay(420, withTiming(0, { duration: 520, easing: EASE_OUT })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anticipate?.key]);

  // ── Homecoming fade (#6): when we return to the home screen, the orb starts at the
  // last chat's hue and eases very slowly back to its idle blue, instead of cutting. ──
  useEffect(() => {
    if (!homecomingFade || homecomingFade.key === 0) return;
    setFadeColor(FAMILY_COLORS[homecomingFade.family]);
    cancelAnimation(tint);
    tint.value = homecomingFade.fromLevel;
    tint.value = withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.sin) });
    const t = setTimeout(() => setFadeColor(null), 3700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homecomingFade?.key]);

  // ── Web: the eyes follow the cursor from a LARGER radius around the orb (#5). We
  // measure the orb's centre on each move and deflect the gaze proportionally, fading
  // out as the cursor drifts past the sensing radius. Window-level (no hit area), so
  // it never blocks taps on the surrounding UI. ──
  useEffect(() => {
    if (Platform.OS !== 'web' || !interactive) return;
    const radius = size * reach;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const onMove = (e: { clientX: number; clientY: number }) => {
      const el = wrapRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
      if (!el || typeof el.getBoundingClientRect !== 'function') return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy) || 0.0001;
      const mag = dist <= radius ? dist / radius : Math.max(0, 1 - (dist - radius) / radius);
      lookX.value = clamp((dx / dist) * mag);
      lookY.value = clamp((dy / dist) * mag);
    };
    const relax = () => {
      lookX.value = withTiming(0, { duration: 700, easing: EASE_OUT });
      lookY.value = withTiming(0, { duration: 700, easing: EASE_OUT });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('blur', relax);
    document.addEventListener('mouseleave', relax);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', relax);
      document.removeEventListener('mouseleave', relax);
    };
  }, [interactive, size, reach, lookX, lookY]);

  const haloSize = size * 1.42;
  const eyeHeight = size * 0.21;
  const eyeWidth = size * 0.088;
  const CENTER = haloSize / 2;
  const HALF = size * 0.5;
  const armD = size * MOTION_CONFIG.armDiameter; // satellite arm-orb diameter
  const MAX_EYE_X = size * 0.05;
  const MAX_EYE_Y = size * 0.04;
  const MAX_HL = size * 0.045;

  const containerStyle = useAnimatedStyle(() => {
    const tremble = (tremorOsc.value * 2 - 1) * emoTremor.value * (size * 0.012);
    const pulseScale = pulseOsc.value * emoPulse.value * 0.03;
    return {
      opacity: 1 - recede.value * 0.35,
      transform: [
        { translateX: dragX.value + recoilX.value + tremble },
        {
          translateY:
            interpolate(floatY.value, [0, 1], [-8, 8]) * emoEnergy.value +
            dragY.value +
            recoilY.value +
            interpolate(speakV.value, [0, 1], [0, -5]) +
            emoSink.value * (size * 0.06) +
            pBy.value, // pose lean / settle / recede
        },
        { rotate: `${pBr.value}deg` }, // pose tilt (notQuite wobble, curious lean)
        {
          scale:
            1 +
            interpolate(breathe.value, [0, 1], [0, 0.045]) * emoEnergy.value +
            poke.value * 0.04 -
            petting.value * 0.03 +
            speakV.value * 0.02 -
            recede.value * 0.08 +
            pulseScale -
            emoContract.value * 0.045 +
            pBs.value, // pose squash/stretch
        },
      ],
    };
  });

  // Drag follow-through: the arms chase the body's drag/recoil with a soft, laggy
  // spring, so they trail behind and settle after it instead of staying centred
  // while the body moves away.
  const armTrailX = useDerivedValue(() => withSpring(dragX.value + recoilX.value, TRAIL_SPRING));
  const armTrailY = useDerivedValue(() => withSpring(dragY.value + recoilY.value, TRAIL_SPRING));

  // Satellite arm orbs: pose position + a small independent idle drift, gently
  // coupled to the breath, plus the trailing drag offset. Left drifts on `drift`,
  // right on `breathe`, so the two never move in lockstep.
  const idle = rm ? 0 : 1;
  const armLStyle = useAnimatedStyle(() => ({
    opacity: aLo.value,
    transform: [
      { translateX: aLx.value + armTrailX.value + (drift.value - 0.5) * 2 * MOTION_CONFIG.idleAmplitude * size * idle },
      { translateY: aLy.value + armTrailY.value + interpolate(floatY.value, [0, 1], [-3, 3]) * idle },
      { scale: aLs.value + interpolate(breathe.value, [0, 1], [0, 0.03]) * idle },
      { rotate: `${aLr.value + armTrailX.value * 0.08}deg` }, // slight arc as they trail
    ],
  }));
  const armRStyle = useAnimatedStyle(() => ({
    opacity: aRo.value,
    transform: [
      { translateX: aRx.value + armTrailX.value - (breathe.value - 0.5) * 2 * MOTION_CONFIG.idleAmplitude * size * idle },
      { translateY: aRy.value + armTrailY.value + interpolate(floatY.value, [0, 1], [3, -3]) * idle },
      { scale: aRs.value + interpolate(breathe.value, [0, 1], [0, 0.03]) * idle },
      { rotate: `${aRr.value + armTrailX.value * 0.08}deg` },
    ],
  }));

  // Emotion hue: the orb visibly becomes the feeling — joy gold, calm teal, sadness
  // blue, etc. — matching the per-emotion colours on the Patterns screen. The primary
  // hue is a full gradient layer (its own alpha carries the strength); a mixed feeling
  // washes a second hue over it. Both halve while the feeling is still uncertain.
  // Default to the orb's own violet when no family, so the tint layer always has a
  // valid colour to render and fade in/out (its opacity is gated by tint.value).
  // A playing learned-emotion sequence wears its own hue (playColor) on top.
  const tintColor = playColor ?? fadeColor ?? (primaryFamily ? FAMILY_COLORS[primaryFamily] : '#6E5BF2');
  const secondColor = secondFamily ? FAMILY_COLORS[secondFamily] : 'transparent';
  // Stable colour key (compared by value, so the memoised layer never re-renders per frame).
  const dailyColorsKey = (dailyHues ?? []).map((f) => FAMILY_COLORS[f]).join('|');
  const tintStyle = useAnimatedStyle(() => ({ opacity: tint.value * tintFactor.value }));
  const secondTintStyle = useAnimatedStyle(() => ({ opacity: secondTint.value * 0.7 * tintFactor.value }));

  const eyeStyle = useAnimatedStyle(() => {
    const closed = 0.07;
    const sy = blink.value + (closed - blink.value) * petting.value;
    return {
      transform: [
        { translateX: lookX.value * MAX_EYE_X },
        { translateY: lookY.value * MAX_EYE_Y },
        { scaleY: sy },
        { scaleX: 1 + poke.value * 0.16 },
      ],
    };
  });

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -lookX.value * MAX_HL },
      { translateY: -lookY.value * MAX_HL },
      { rotate: '-16deg' },
    ],
  }));

  const content = (
    <View ref={wrapRef} style={[styles.wrap, { width: haloSize, height: haloSize, pointerEvents: interactive ? 'auto' : 'none' }, style]}>
      <Animated.View style={containerStyle}>
        <View style={[styles.orb, { width: size, height: size, borderRadius: size / 2, boxShadow: BASE_GLOW }]}>
          <OrbGradientLayer kind="base" />
          {/* Emotion hue (foreground strand) — the orb becomes the feeling's colour */}
          <Animated.View style={[StyleSheet.absoluteFill, tintStyle]}>
            <EmotionTintLayer color={tintColor} />
          </Animated.View>
          {/* Background strand of a mixed feeling — a second hue washed over the first */}
          <Animated.View style={[StyleSheet.absoluteFill, secondTintStyle]}>
            <SecondTintLayer color={secondColor} />
          </Animated.View>
          {/* Very subtle hints of the feelings explored today (resets at midnight) */}
          <DailyHuesLayer colorsKey={dailyColorsKey} />
          <Animated.View style={[styles.highlight, { width: size * 0.4, height: size * 0.26 }, highlightStyle]} />
          <OrbGradientLayer kind="sheen" />

          <View style={styles.eyeRow}>
            <Animated.View style={[styles.eye, { width: eyeWidth, height: eyeHeight, borderRadius: eyeWidth / 2 }, eyeStyle]} />
            <Animated.View style={[styles.eye, { width: eyeWidth, height: eyeHeight, borderRadius: eyeWidth / 2 }, eyeStyle]} />
          </View>
        </View>
      </Animated.View>

      {/* Satellite arm orbs — detached, floating beside the body. Rendered in the
          FOREGROUND so they stay visible as they animate, never hidden behind it. */}
      {[
        { key: 'L', s: armLStyle },
        { key: 'R', s: armRStyle },
      ].map(({ key, s }) => (
        <Animated.View
          key={key}
          style={[
            styles.armOrb,
            { width: armD, height: armD, borderRadius: armD / 2, left: CENTER - armD / 2, top: CENTER - armD / 2, boxShadow: ARM_GLOW },
            s,
          ]}
        >
          <OrbGradientLayer kind="base" />
          <Animated.View style={[StyleSheet.absoluteFill, tintStyle]}>
            <EmotionTintLayer color={tintColor} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, secondTintStyle]}>
            <SecondTintLayer color={secondColor} />
          </Animated.View>
        </Animated.View>
      ))}
    </View>
  );

  if (!interactive) return content;

  const pan = Gesture.Pan()
    .onBegin((e) => {
      lookX.value = Math.min(1, Math.max(-1, (e.x - CENTER) / HALF));
      lookY.value = Math.min(1, Math.max(-1, (e.y - CENTER) / HALF));
    })
    .onUpdate((e) => {
      lookX.value = Math.min(1, Math.max(-1, (e.x - CENTER) / HALF));
      lookY.value = Math.min(1, Math.max(-1, (e.y - CENTER) / HALF));
      const factor = petting.value > 0.5 ? 0.08 : 0.3;
      dragX.value = e.translationX * factor;
      dragY.value = e.translationY * factor;
    })
    .onFinalize(() => {
      dragX.value = withSpring(0, { damping: 9, stiffness: 120 });
      dragY.value = withSpring(0, { damping: 9, stiffness: 120 });
      lookX.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.quad) });
      lookY.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.quad) });
    });

  const longPress = Gesture.LongPress()
    .minDuration(330)
    .maxDistance(10000)
    .onStart(() => {
      petting.value = withTiming(1, { duration: 340, easing: Easing.inOut(Easing.sin) });
    })
    .onFinalize(() => {
      petting.value = withTiming(0, { duration: 450, easing: Easing.inOut(Easing.sin) });
    });

  const tap = Gesture.Tap()
    .maxDuration(260)
    .onEnd((e) => {
      const nx = Math.min(1, Math.max(-1, (e.x - CENTER) / HALF));
      const ny = Math.min(1, Math.max(-1, (e.y - CENTER) / HALF));
      recoilX.value = withSequence(withTiming(-nx * 16, { duration: 90 }), withSpring(0, { damping: 6, stiffness: 150 }));
      recoilY.value = withSequence(withTiming(-ny * 12, { duration: 90 }), withSpring(0, { damping: 6, stiffness: 150 }));
      poke.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 280 }));
      lookX.value = withSequence(withTiming(nx, { duration: 80 }), withTiming(0, { duration: 420 }));
      lookY.value = withSequence(withTiming(ny, { duration: 80 }), withTiming(0, { duration: 420 }));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .onStart(() => {
      glow.value = withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 800 }));
      if (onDoubleTap) runOnJS(onDoubleTap)();
    });

  // On web the eyes track the cursor via the window-level pointer listener above
  // (wider radius); on touch, the pan/tap gestures drive the gaze.
  const taps = Gesture.Exclusive(doubleTap, tap);
  const touchGesture = Gesture.Simultaneous(pan, longPress, taps);

  return <GestureDetector gesture={touchGesture}>{content}</GestureDetector>;
}

const styles = StyleSheet.create({
  // overflow visible so the satellite arms can float beyond the halo box (into the
  // empty space around the orb) without enlarging the component's layout footprint.
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  orb: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', elevation: 12 },
  armOrb: { position: 'absolute', overflow: 'hidden', elevation: 8 },
  highlight: {
    position: 'absolute',
    top: '14%',
    left: '18%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  eyeRow: { flexDirection: 'row', gap: 21, alignItems: 'center' },
  eye: { backgroundColor: '#FBFCFF', boxShadow: '0px 2px 4px rgba(42,42,85,0.18)' },
});
