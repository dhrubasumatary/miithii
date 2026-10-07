import { Pressable, StyleSheet, View } from 'react-native';
import { cue } from '../lib/haptics';
import { useTheme } from '../theme/ThemeProvider';

export function ThemeSwitch() {
  const theme = useTheme();
  const dark = theme.mode === 'dark';
  return <Pressable accessibilityRole="button"
    accessibilityLabel={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    accessibilityState={{ disabled: theme.transitioning, busy: theme.transitioning }}
    disabled={theme.transitioning}
    onPress={() => { cue('listening'); theme.toggle(); }}
    style={({ pressed }) => [styles.control, { borderColor: theme.palette.hairline.strong,
      backgroundColor: pressed ? theme.palette.surface.controlPressed : theme.palette.surface.raised }] }>
    {({ pressed }) => {
      const surface = pressed ? theme.palette.surface.controlPressed : theme.palette.surface.raised;
      return dark
        ? <Sun color={theme.palette.text.muted} />
        : <Moon color={theme.palette.text.muted} surface={surface} />;
    }}
  </Pressable>;
}

function Sun({ color }: { color: string }) {
  return <View accessible={false} style={styles.glyph}>
    <View style={[styles.sunCore, { backgroundColor: color }]} />
    <View style={[styles.ray, styles.rayTop, { backgroundColor: color }]} />
    <View style={[styles.ray, styles.rayBottom, { backgroundColor: color }]} />
    <View style={[styles.ray, styles.rayLeft, { backgroundColor: color }]} />
    <View style={[styles.ray, styles.rayRight, { backgroundColor: color }]} />
    <View style={[styles.ray, styles.rayNorthWest, { backgroundColor: color }]} />
    <View style={[styles.ray, styles.rayNorthEast, { backgroundColor: color }]} />
    <View style={[styles.ray, styles.raySouthWest, { backgroundColor: color }]} />
    <View style={[styles.ray, styles.raySouthEast, { backgroundColor: color }]} />
  </View>;
}

function Moon({ color, surface }: { color: string; surface: string }) {
  return <View accessible={false} style={styles.glyph}>
    <View style={[styles.moon, { backgroundColor: color }]} />
    <View style={[styles.moonCutout, { backgroundColor: surface }]} />
  </View>;
}

const styles = StyleSheet.create({
  control: { height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  glyph: { width: 24, height: 24, position: 'relative' },
  sunCore: { position: 'absolute', left: 7, top: 7, width: 10, height: 10, borderRadius: 5 },
  ray: { position: 'absolute', borderRadius: 1 },
  rayTop: { left: 11, top: 0, width: 2, height: 4 },
  rayBottom: { left: 11, bottom: 0, width: 2, height: 4 },
  rayLeft: { left: 0, top: 11, width: 4, height: 2 },
  rayRight: { right: 0, top: 11, width: 4, height: 2 },
  rayNorthWest: { left: 3, top: 3, width: 4, height: 2, transform: [{ rotate: '45deg' }] },
  rayNorthEast: { right: 3, top: 3, width: 4, height: 2, transform: [{ rotate: '-45deg' }] },
  raySouthWest: { left: 3, bottom: 3, width: 4, height: 2, transform: [{ rotate: '-45deg' }] },
  raySouthEast: { right: 3, bottom: 3, width: 4, height: 2, transform: [{ rotate: '45deg' }] },
  moon: { position: 'absolute', left: 2, top: 3, width: 18, height: 18, borderRadius: 9 },
  moonCutout: { position: 'absolute', left: 9, top: 0, width: 16, height: 16, borderRadius: 8 },
});
