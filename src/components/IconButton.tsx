import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type ViewStyle } from 'react-native';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { gradients, palette, radii } from '@/theme/tokens';

type Props = {
  name: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  diameter?: number;
  iconSize?: number;
  variant?: 'glass' | 'accent';
  iconColor?: string;
  style?: ViewStyle;
};

/** Circular button — frosted glass by default, or a gradient accent (send/mic). */
export function IconButton({
  name,
  onPress,
  diameter = 44,
  iconSize = 20,
  variant = 'glass',
  iconColor,
  style,
}: Props) {
  const circle: ViewStyle = {
    width: diameter,
    height: diameter,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (variant === 'accent') {
    return (
      <PressableScale onPress={onPress} style={style}>
        <LinearGradient
          colors={gradients.accentButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[circle, styles.accentShadow]}
        >
          <Feather name={name} size={iconSize} color={iconColor ?? palette.white} />
        </LinearGradient>
      </PressableScale>
    );
  }

  return (
    <PressableScale onPress={onPress} style={style}>
      <Glass radius={radii.full} style={circle} contentStyle={circle}>
        <Feather name={name} size={iconSize} color={iconColor ?? palette.inkOnGlass} />
      </Glass>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  accentShadow: {
    boxShadow: '0px 6px 12px rgba(91,107,240,0.4)',
    elevation: 6,
  },
});
