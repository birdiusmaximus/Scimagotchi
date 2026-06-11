import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { FAMILY_COLORS } from '@/data/emotionMaps';
import { gradients, palette } from '@/theme/tokens';
import type { EmotionFamilyId } from '@/types/models';
import { withAlpha } from '@/utils/color';

// Crisp ease-out (from the remotion best-practices skill) for the hue swelling in.
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

type BlobSpec = {
  colors: [string, string];
  size: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  opacity: number;
  /** seconds for one drift cycle */
  drift: number;
  dx: number;
  dy: number;
};

// Soft colour blobs that bleed off the edges, echoing the reference background.
const BLOBS: BlobSpec[] = [
  { colors: [palette.blobViolet, palette.blobPeriwinkle], size: 360, top: -150, left: -130, opacity: 0.5, drift: 13, dx: 14, dy: 18 },
  { colors: [palette.blobMagenta, palette.blobPink], size: 320, top: -120, right: -140, opacity: 0.5, drift: 16, dx: -16, dy: 12 },
  { colors: [palette.blobPeriwinkle, palette.blobMint], size: 300, top: 240, right: -150, opacity: 0.42, drift: 19, dx: -12, dy: -16 },
  { colors: [palette.blobPink, palette.blobMagenta], size: 340, bottom: -150, left: -140, opacity: 0.46, drift: 15, dx: 16, dy: -14 },
  { colors: [palette.blobViolet, palette.blobPink], size: 320, bottom: -170, right: -120, opacity: 0.44, drift: 21, dx: -14, dy: -18 },
];

function Blob({ spec }: { spec: BlobSpec }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: spec.drift * 1000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [spec.drift, t]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [0, spec.dx]) },
      { translateY: interpolate(t.value, [0, 1], [0, spec.dy]) },
    ],
  }));

  const position: ViewStyle = {
    top: spec.top,
    left: spec.left,
    right: spec.right,
    bottom: spec.bottom,
    width: spec.size,
    height: spec.size,
    borderRadius: spec.size / 2,
    opacity: spec.opacity,
  };

  return (
    <Animated.View style={[styles.blob, position, style]}>
      <LinearGradient
        colors={spec.colors}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/**
 * A reactive hue that swells in the upper field (behind the companion) when a
 * feeling is in play, then recedes when it isn't — so the room subtly takes the
 * emotion's colour without flooding the whole screen. Slot 0 sits centre, slot 1
 * (the second strand of a mixed feeling) offsets, so a combination reads as two
 * overlapping washes. The colour is held during fade-out.
 */
function EmotionBlob({ family, slot }: { family: EmotionFamilyId | null; slot: 0 | 1 }) {
  const present = useSharedValue(0);
  const drift = useSharedValue(0);
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (family) setColor(FAMILY_COLORS[family]); // keep the last colour for the fade-out
    present.value = withTiming(family ? 1 : 0, { duration: 1100, easing: EASE_OUT });
  }, [family, present]);

  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: (17 + slot * 4) * 1000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [slot, drift]);

  const style = useAnimatedStyle(() => ({
    // grows from a small seed to a broad wash as the feeling lands.
    opacity: present.value * 0.55,
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [0, slot === 0 ? 16 : -18]) },
      { translateY: interpolate(drift.value, [0, 1], [0, 14]) },
      { scale: interpolate(present.value, [0, 1], [0.55, 1]) },
    ],
  }));

  if (!color) return null;
  const size = 440;
  const position: ViewStyle =
    slot === 0
      ? { top: -90, alignSelf: 'center', width: size, height: size, borderRadius: size / 2 }
      : { top: 10, right: -40, width: size * 0.86, height: size * 0.86, borderRadius: size / 2 };

  return (
    <Animated.View style={[styles.blob, position, style]}>
      <LinearGradient
        colors={[withAlpha(color, 0.85), withAlpha(color, 0.18)]}
        start={{ x: 0.5, y: 0.15 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/**
 * Full-screen dreamy background: a pastel gradient wash, slowly drifting colour
 * blobs, and a soft blur layer that melts them into the airy reference look.
 * Pass `families` (the feeling(s) in play) to let the room take the emotion's hue.
 * Content is rendered above this (it stays crisp).
 */
export function GradientBackground({ families = [] }: { families?: EmotionFamilyId[] }) {
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <LinearGradient
        colors={gradients.background}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        locations={[0, 0.4, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      {BLOBS.map((spec, i) => (
        <Blob key={i} spec={spec} />
      ))}
      {/* Emotion-reactive hue(s) behind the companion — grow in, recede out. */}
      <EmotionBlob family={families[0] ?? null} slot={0} />
      <EmotionBlob family={families[1] ?? null} slot={1} />
      {/* Softens the blobs into gentle washes and adds the airy pastel haze. */}
      <BlurView intensity={64} tint="light" style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
