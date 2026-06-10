import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { gradients, palette } from '@/theme/tokens';

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
 * Full-screen dreamy background: a pastel gradient wash, slowly drifting colour
 * blobs, and a soft blur layer that melts them into the airy reference look.
 * Content is rendered above this (it stays crisp).
 */
export function GradientBackground() {
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
