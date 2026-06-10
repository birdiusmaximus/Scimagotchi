import { Text, type TextProps, type TextStyle } from 'react-native';

import { fontFamily, fontFamilyCondensed, fontFamilyDisplay, palette, type as typeScale } from '@/theme/tokens';

type Variant = keyof typeof typeScale;

type Props = TextProps & {
  variant?: Variant;
  color?: string;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
  /** Override the family: 'display' (Neue Haas Display), 'condensed' (Acumin), or 'body'. */
  font?: 'display' | 'condensed' | 'body';
};

/**
 * App-wide text primitive. Body copy uses Neue Haas Grotesk Text; headings
 * (h1/subtitle) use the Display optical size at a confident 600; large stat
 * numerals can opt into the condensed face via font="condensed".
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
  const family = font === 'condensed' ? fontFamilyCondensed : useDisplay ? fontFamilyDisplay : fontFamily;
  const resolvedWeight = weight ?? (useDisplay ? '600' : undefined);

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
