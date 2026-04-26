import React, { Children, isValidElement } from 'react';
import { StyleSheet, View } from 'react-native';
import HUDPanel from '../../home/components/HUDPanel';
import { SystemTokens } from '../../home/systemTokens';

interface Props {
  label: string;
  children: React.ReactNode;
}

const SettingsSection: React.FC<Props> = ({ label, children }) => {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <HUDPanel headerLabel={label.toUpperCase()}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {child}
          {i < items.length - 1 ? <View style={styles.sep} /> : null}
        </React.Fragment>
      ))}
    </HUDPanel>
  );
};

const styles = StyleSheet.create({
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SystemTokens.divider,
    marginLeft: 36,
  },
});

export default SettingsSection;
