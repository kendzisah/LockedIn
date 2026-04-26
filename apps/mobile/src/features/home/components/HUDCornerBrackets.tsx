/**
 * HUDCornerBrackets — Four L-shaped corner marks rendered absolutely
 * inside a panel. Pure SVG, no animation by default — parent can wrap
 * the rendered View in an Animated.View if it wants to drive opacity.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SystemTokens } from '../systemTokens';

interface HUDCornerBracketsProps {
  color?: string;
  size?: number;
  thickness?: number;
  opacity?: number;
}

const HUDCornerBrackets: React.FC<HUDCornerBracketsProps> = ({
  color = SystemTokens.bracketColor,
  size = 14,
  thickness = 1.5,
  opacity = 1,
}) => {
  const path = `M0 ${size} L0 0 L${size} 0`;

  return (
    <View style={styles.layer} pointerEvents="none">
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={[styles.corner, styles.tl]}
      >
        <Path
          d={path}
          stroke={color}
          strokeWidth={thickness}
          strokeOpacity={opacity}
          fill="none"
        />
      </Svg>

      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={[styles.corner, styles.tr]}
      >
        <Path
          d={path}
          stroke={color}
          strokeWidth={thickness}
          strokeOpacity={opacity}
          fill="none"
          transform={`scale(-1, 1) translate(${-size}, 0)`}
        />
      </Svg>

      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={[styles.corner, styles.bl]}
      >
        <Path
          d={path}
          stroke={color}
          strokeWidth={thickness}
          strokeOpacity={opacity}
          fill="none"
          transform={`scale(1, -1) translate(0, ${-size})`}
        />
      </Svg>

      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={[styles.corner, styles.br]}
      >
        <Path
          d={path}
          stroke={color}
          strokeWidth={thickness}
          strokeOpacity={opacity}
          fill="none"
          transform={`scale(-1, -1) translate(${-size}, ${-size})`}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  corner: {
    position: 'absolute',
  },
  tl: { top: -1, left: -1 },
  tr: { top: -1, right: -1 },
  bl: { bottom: -1, left: -1 },
  br: { bottom: -1, right: -1 },
});

export default React.memo(HUDCornerBrackets);
