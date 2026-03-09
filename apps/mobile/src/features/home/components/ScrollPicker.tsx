/**
 * ScrollPicker — Apple-style drum-roller number picker with haptic feedback.
 *
 * Uses a vertical FlatList with snap-to-interval and a highlight overlay
 * to simulate iOS picker wheel behavior.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface ScrollPickerProps {
  values: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  formatValue?: (value: number) => string;
  label?: string;
  style?: ViewStyle;
}

const ScrollPicker: React.FC<ScrollPickerProps> = ({
  values,
  selectedValue,
  onValueChange,
  formatValue,
  label,
  style,
}) => {
  const flatListRef = useRef<FlatList<number>>(null);
  const lastHapticIndex = useRef(-1);
  const isUserScrolling = useRef(false);

  const paddedValues = React.useMemo(() => {
    const padding = Math.floor(VISIBLE_ITEMS / 2);
    const padArray = Array(padding).fill(-1);
    return [...padArray, ...values, ...padArray];
  }, [values]);

  const selectedIndex = values.indexOf(selectedValue);

  useEffect(() => {
    if (!isUserScrolling.current && selectedIndex >= 0) {
      flatListRef.current?.scrollToOffset({
        offset: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedIndex]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(values.length - 1, index));

      if (clampedIndex !== lastHapticIndex.current) {
        lastHapticIndex.current = clampedIndex;
        Haptics.selectionAsync();
      }
    },
    [values.length],
  );

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isUserScrolling.current = false;
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(values.length - 1, index));
      onValueChange(values[clampedIndex]);
    },
    [values, onValueChange],
  );

  const handleScrollBegin = useCallback(() => {
    isUserScrolling.current = true;
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: number; index: number }) => {
      if (item === -1) {
        return <View style={styles.item} />;
      }
      const realIndex = index - Math.floor(VISIBLE_ITEMS / 2);
      const isSelected = realIndex === selectedIndex;
      return (
        <View style={styles.item}>
          <Text
            style={[
              styles.itemText,
              isSelected && styles.itemTextSelected,
              !isSelected && styles.itemTextDimmed,
            ]}
          >
            {formatValue ? formatValue(item) : item.toString()}
          </Text>
        </View>
      );
    },
    [selectedIndex, formatValue],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.pickerWrapper}>
        <View style={styles.highlight} pointerEvents="none" />
        <FlatList
          ref={flatListRef}
          data={paddedValues}
          keyExtractor={(_, i) => i.toString()}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBegin}
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
          bounces={false}
          style={styles.flatList}
          contentContainerStyle={{ backgroundColor: 'transparent' }}
          CellRendererComponent={({ children, style: cellStyle, ...rest }) => (
            <View {...rest} style={[cellStyle, { backgroundColor: 'transparent' }]}>
              {children}
            </View>
          )}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  pickerWrapper: {
    height: PICKER_HEIGHT,
    overflow: 'hidden',
    borderRadius: 12,
    position: 'relative',
  },
  flatList: {
    height: PICKER_HEIGHT,
    backgroundColor: 'transparent',
  },
  highlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  itemTextSelected: {
    fontSize: 28,
    color: Colors.textPrimary,
  },
  itemTextDimmed: {
    opacity: 0.4,
  },
});

export default React.memo(ScrollPicker);
