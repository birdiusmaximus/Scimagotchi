import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { palette, radii } from '@/theme/tokens';

type Props = ViewProps & {
  intensity?: number;
  tint?: 'light' | 'default' | 'dark' | 'extraLight';
  fill?: string;
  border?: string;
  borderWidth?: number;
  radius?: number;
  contentStyle?: ViewStyle;
  children?: ReactNode;
};

/**
 * A frosted-glass surface: real backdrop blur + a translucent fill + a soft
 * highlight border. The building block for chips, the chat input and buttons.
 */
export function Glass({
  intensity = 52,
  tint = 'light',
  fill = palette.glassFill,
  border = palette.glassBorder,
  borderWidth = 1,
  radius = radii.lg,
  contentStyle,
  children,
  style,
  ...rest
}: Props) {
  return (
    <View
      style={[{ borderRadius: radius, borderWidth, borderColor: border, overflow: 'hidden' }, style]}
      {...rest}
    >
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}
