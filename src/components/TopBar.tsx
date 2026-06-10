import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/IconButton';

type Props = {
  onLeft?: () => void;
  onRight?: () => void;
};

/** Home top bar: menu (left) and settings (right) as frosted circular buttons. */
export function TopBar({ onLeft, onRight }: Props) {
  return (
    <View style={styles.row}>
      <IconButton name="menu" onPress={onLeft} />
      <IconButton name="settings" onPress={onRight} />
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
