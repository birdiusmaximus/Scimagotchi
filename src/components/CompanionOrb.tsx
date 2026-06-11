import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { FAMILY_COLORS } from '@/data/emotionMaps';
import type { CompanionVisualState } from '@/services/ai/companionVisualState';
import { expressionFor } from '@/services/ai/orbExpression';
import { gradients } from '@/theme/tokens';
import type { EmotionFamilyId } from '@/types/models';

type Props = {
  size?: number;
  /** Subtly tints the orb's hue toward this emotion (not a full colour change). */
  family?: EmotionFamilyId | null;
  /** Foreground + (optional) background strand hues for mixed states (overrides family). */
  tintFamilies?: EmotionFamilyId[];
  /** What the orb should communicate (engine brief §18); ambience only, never reward. */
  visual?: CompanionVisualState;
  /** Enable touch reactions: eyes follow the finger, poke recoil, pet to close. */
  interactive?: boolean;
  /** Bump `key` (with a sentence count) to make the orb react as it "speaks". */
  speak?: { key: number; sentences: number };
  style?: ViewStyle;
};

const BASE_GLOW = '0px 0px 44px 6px rgba(124,92,242,0.42), 0px 0px 96px 20px rgba(110,124,242,0.26), 0px 14px 30px rgba(70,70,140,0.26)';

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
  visual = 'idle_calm',
  interactive = false,
  speak,
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

  useEffect(() => {
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
  }, [floatY, breathe, aura, blink, tremorOsc, pulseOsc]);

  const primaryFamily = tintFamilies?.[0] ?? family;
  const secondFamily = tintFamilies?.[1] ?? null;

  // Ease the emotion tints in/out when the families change.
  useEffect(() => {
    tint.value = withTiming(primaryFamily ? 1 : 0, { duration: 800, easing: Easing.inOut(Easing.sin) });
    secondTint.value = withTiming(secondFamily ? 1 : 0, { duration: 800, easing: Easing.inOut(Easing.sin) });
  }, [primaryFamily, secondFamily, tint, secondTint]);

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

  const haloSize = size * 1.42;
  const eyeHeight = size * 0.21;
  const eyeWidth = size * 0.088;
  const CENTER = haloSize / 2;
  const HALF = size * 0.5;
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
            emoSink.value * (size * 0.06),
        },
        {
          scale:
            1 +
            interpolate(breathe.value, [0, 1], [0, 0.045]) * emoEnergy.value +
            poke.value * 0.04 -
            petting.value * 0.03 +
            speakV.value * 0.02 -
            recede.value * 0.08 +
            pulseScale -
            emoContract.value * 0.045,
        },
      ],
    };
  });

  const auraStyle = useAnimatedStyle(() => ({
    opacity: interpolate(aura.value, [0, 1], [0.28, 0.55]) + glow.value * 0.4 + petting.value * 0.18,
    transform: [{ scale: interpolate(aura.value, [0, 1], [1, 1.07]) + glow.value * 0.06 + petting.value * 0.03 }],
  }));

  const tintStyle = useAnimatedStyle(() => ({ opacity: tint.value * 0.24 * tintFactor.value }));
  const secondTintStyle = useAnimatedStyle(() => ({ opacity: secondTint.value * 0.13 * tintFactor.value }));

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

  const tintColor = primaryFamily ? FAMILY_COLORS[primaryFamily] : 'transparent';
  const secondColor = secondFamily ? FAMILY_COLORS[secondFamily] : 'transparent';

  const content = (
    <View style={[styles.wrap, { width: haloSize, height: haloSize, pointerEvents: interactive ? 'auto' : 'none' }, style]}>
      <Animated.View
        style={[styles.aura, { width: haloSize, height: haloSize, borderRadius: haloSize / 2 }, auraStyle]}
      />
      <View style={[styles.halo, { width: size * 1.2, height: size * 1.2, borderRadius: (size * 1.2) / 2 }]} />

      <Animated.View style={containerStyle}>
        <View style={[styles.orb, { width: size, height: size, borderRadius: size / 2, boxShadow: BASE_GLOW }]}>
          <OrbGradientLayer kind="base" />
          {/* Subtle emotion hue (foreground strand) */}
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }, tintStyle]} />
          {/* Background strand of a mixed feeling — a second, fainter hue layered in */}
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: secondColor }, secondTintStyle]} />
          <Animated.View style={[styles.highlight, { width: size * 0.4, height: size * 0.26 }, highlightStyle]} />
          <OrbGradientLayer kind="sheen" />

          <View style={styles.eyeRow}>
            <Animated.View style={[styles.eye, { width: eyeWidth, height: eyeHeight, borderRadius: eyeWidth / 2 }, eyeStyle]} />
            <Animated.View style={[styles.eye, { width: eyeWidth, height: eyeHeight, borderRadius: eyeWidth / 2 }, eyeStyle]} />
          </View>
        </View>
      </Animated.View>
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
    });

  const hover = Gesture.Hover()
    .onBegin((e) => {
      lookX.value = Math.min(1, Math.max(-1, (e.x - CENTER) / HALF));
      lookY.value = Math.min(1, Math.max(-1, (e.y - CENTER) / HALF));
    })
    .onUpdate((e) => {
      lookX.value = Math.min(1, Math.max(-1, (e.x - CENTER) / HALF));
      lookY.value = Math.min(1, Math.max(-1, (e.y - CENTER) / HALF));
    })
    .onEnd(() => {
      lookX.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.quad) });
      lookY.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.quad) });
    });

  const taps = Gesture.Exclusive(doubleTap, tap);
  const gesture =
    Platform.OS === 'web'
      ? Gesture.Simultaneous(hover, pan, longPress, taps)
      : Gesture.Simultaneous(pan, longPress, taps);

  return <GestureDetector gesture={gesture}>{content}</GestureDetector>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  aura: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)' },
  halo: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  orb: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', elevation: 12 },
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
