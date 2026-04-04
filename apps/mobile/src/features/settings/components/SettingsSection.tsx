import React, { Children, isValidElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../../design/colors';
import { FontFamily } from '../../../design/typography';

interface Props {
  label: string;
  children: React.ReactNode;
}

const SettingsSection: React.FC<Props> = ({ label, children }) => {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.card}>
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {child}
            {i < items.length - 1 ? <View style={styles.sep} /> : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingLeft: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 0,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.surface,
    marginLeft: 52,
  },
});

export default SettingsSection;
