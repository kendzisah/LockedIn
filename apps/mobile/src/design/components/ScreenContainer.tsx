import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../colors';

interface ScreenContainerProps {
  children: React.ReactNode;
  /** Center content vertically (default true) */
  centered?: boolean;
}

const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  centered = true,
}) => {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.content, centered && styles.centered]}>
        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  centered: {
    justifyContent: 'center',
  },
});

export default ScreenContainer;
