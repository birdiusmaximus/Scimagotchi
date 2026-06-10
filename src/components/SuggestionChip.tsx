import { Feather } from '@expo/vector-icons';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { palette, radii, spacing } from '@/theme/tokens';

type Props = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress?: () => void;
};

/** A frosted entry-point chip: small icon + short label, used in a 2×2 grid. */
export function SuggestionChip({ icon, label, onPress }: Props) {
  return (
    <PressableScale onPress={onPress} style={{ flexGrow: 1, flexBasis: '47%' }}>
      <Glass
        radius={radii.md}
        fill={palette.glassFillSoft}
        contentStyle={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: 14,
          paddingHorizontal: spacing.md,
        }}
      >
        <Feather name={icon} size={17} color={palette.accentDeep} />
        <Txt variant="chip" color={palette.inkOnGlass} numberOfLines={1}>
          {label}
        </Txt>
      </Glass>
    </PressableScale>
  );
}
