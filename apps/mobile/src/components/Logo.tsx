import { Image } from 'react-native';
import { usePalette } from '../theme/ThemeProvider';

/** Miithii's logo is the lowercase wordmark. */
export function Wordmark({ size = 190 }: { size?: number }) {
  const palette = usePalette();
  return <Image accessibilityLabel="Miithii" source={require('../../assets/wordmark.png')}
    resizeMode="contain" style={{ width: size, height: size * 130 / 765, tintColor: palette.text.bone }} />;
}
