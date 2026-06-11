import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/IconButton';

type Props = {
  onLeft?: () => void;
  onRight?: () => void;
};

/** Home top bar: a frosted menu button (left) and a gradient memory shortcut (right). */
export function TopBar({ onLeft, onRight }: Props) {
  return (
    <View style={styles.row}>
      <IconButton name="menu" onPress={onLeft} />
      <IconButton name="calendar" variant="accent" onPress={onRight} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
