import { Text, type TextProps, type TextStyle } from 'react-native';

import { fontFamily, fontFamilyDisplay, palette, type as typeScale } from '@/theme/tokens';

type Variant = keyof typeof typeScale;

type Props = TextProps & {
  variant?: Variant;
  color?: string;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
  /** Override the family: 'display' (Eixample) or 'body' (rounded sans). */
  font?: 'display' | 'body';
};

/**
 * App-wide text primitive. Body copy uses the rounded sans for readability;
 * headings (h1/subtitle) use the Eixample display face. The loaded display weight
 * is 500, so display text defaults there to avoid faux-bold on a high-contrast
 * face.
 */
export function Txt({
  variant = 'body',
  color = palette.ink,
  align,
  weight,
  font,
  style,
  ...rest
}: Props) {
  const useDisplay = font ? font === 'display' : variant === 'h1' || variant === 'subtitle';
  const family = useDisplay ? fontFamilyDisplay : fontFamily;
  const resolvedWeight = weight ?? (useDisplay ? '500' : undefined);

  return (
    <Text
      style={[
        typeScale[variant],
        {
          fontFamily: family,
          color,
          textAlign: align,
          ...(resolvedWeight ? { fontWeight: resolvedWeight } : null),
        },
        style,
      ]}
      {...rest}
    />
  );
}
