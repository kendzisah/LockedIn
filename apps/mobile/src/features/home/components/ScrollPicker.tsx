/**
 * ScrollPicker — Glassmorphic drum-roller number picker with haptic feedback.
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

const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
/** Leading/trailing spacer rows so the first & last values can scroll to the center band. */
const PADDING = Math.floor(VISIBLE_ITEMS / 2);

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
    const padArray = Array(PADDING).fill(-1);
    return [...padArray, ...values, ...padArray];
  }, [values]);

  /**
   * Scroll offset y centers value index v in the middle highlight row when y === v * ITEM_HEIGHT
   * (highlight is PADDING rows from the top; geometry: scrollY + PADDING*H === (PADDING+v)*H).
   */
  const snapOffsets = React.useMemo(
    () => values.map((_, i) => i * ITEM_HEIGHT),
    [values],
  );

  const maxScrollY = Math.max(0, paddedValues.length * ITEM_HEIGHT - PICKER_HEIGHT);

  const selectedIndex = values.indexOf(selectedValue);

  const clampScrollY = useCallback(
    (y: number) => Math.max(0, Math.min(maxScrollY, y)),
    [maxScrollY],
  );

  useEffect(() => {
    if (!isUserScrolling.current && selectedIndex >= 0) {
      const offset = clampScrollY(selectedIndex * ITEM_HEIGHT);
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset, animated: false });
      });
    }
  }, [selectedIndex, values.length, clampScrollY]);

  const valueIndexFromScrollY = useCallback(
    (y: number) => {
      const v = Math.round(y / ITEM_HEIGHT);
      return Math.max(0, Math.min(values.length - 1, v));
    },
    [values.length],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const valueIndex = valueIndexFromScrollY(y);

      if (valueIndex !== lastHapticIndex.current) {
        lastHapticIndex.current = valueIndex;
        Haptics.selectionAsync();
      }
    },
    [valueIndexFromScrollY],
  );

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isUserScrolling.current = false;
      const y = event.nativeEvent.contentOffset.y;
      const clampedValueIndex = valueIndexFromScrollY(y);
      const targetOffset = clampScrollY(clampedValueIndex * ITEM_HEIGHT);
      if (Math.abs(y - targetOffset) > 0.5) {
        flatListRef.current?.scrollToOffset({ offset: targetOffset, animated: true });
      }
      onValueChange(values[clampedValueIndex]);
    },
    [values, onValueChange, valueIndexFromScrollY, clampScrollY],
  );

  const handleScrollBegin = useCallback(() => {
    isUserScrolling.current = true;
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: number; index: number }) => {
      if (item === -1) {
        return <View style={styles.item} />;
      }
      const realIndex = index - PADDING;
      const isSelected = realIndex === selectedIndex;
      const distance = Math.abs(realIndex - selectedIndex);
      return (
        <View style={styles.item}>
          <Text
            style={[
              styles.itemText,
              isSelected && styles.itemTextSelected,
              !isSelected && { opacity: Math.max(0.15, 0.5 - distance * 0.15) },
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
        {/* Highlight band — behind the list */}
        <View style={styles.highlight} />
        <FlatList
          nestedScrollEnabled
          ref={flatListRef}
          data={paddedValues}
          keyExtractor={(_, i) => i.toString()}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          snapToOffsets={snapOffsets}
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
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pickerWrapper: {
    height: PICKER_HEIGHT,
    overflow: 'hidden',
    borderRadius: 16,
    position: 'relative',
  },
  flatList: {
    height: PICKER_HEIGHT,
    backgroundColor: 'transparent',
  },
  highlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
    left: 4,
    right: 4,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(58,102,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(58,102,255,0.15)',
    pointerEvents: 'none',
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  itemText: {
    fontFamily: FontFamily.heading,
    fontSize: 22,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  itemTextSelected: {
    fontFamily: FontFamily.headingBold,
    fontSize: 30,
    color: Colors.textPrimary,
  },
});

export default React.memo(ScrollPicker);
