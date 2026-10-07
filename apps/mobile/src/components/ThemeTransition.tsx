import MaskedView from '@react-native-masked-view/masked-view';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { motion } from '../theme/tokens';
import { themeMaskFrames } from '../theme/themeMaskFrames';

/** Same expanding GIF mask as the retired web theme transition; no runtime remount. */
export function ThemeTransition({ previous, next, reducedMotion, onFinish }: {
  previous: string; next: string; reducedMotion: boolean; onFinish: () => void;
}) {
  const progress = useRef(new Animated.Value(0.01)).current;
  const frameClock = useRef(new Animated.Value(0)).current;
  const [loaded, setLoaded] = useState(0);
  const [maskLoaded, setMaskLoaded] = useState(0);
  const loadedFrames = useRef(new Set<number>());
  const { width, height } = useWindowDimensions();
  const size = Math.max(width, height) * 0.22;
  const maskStyle = { transform: [{ scale: progress }] };
  useEffect(() => {
    if (reducedMotion) {
      onFinish();
      return;
    }
    if (loaded !== 3 || maskLoaded !== themeMaskFrames.length) return;
    // All frames are decoded before playback. Visibility and scale run natively:
    // changing an Image source on a JS timer stalled Android on its first decoded pose.
    const frames = Animated.loop(Animated.timing(frameClock, {
      toValue: themeMaskFrames.length, duration: themeMaskFrames.length * 40,
      easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    }));
    frames.start();
    const animation = Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: motion.themeReveal * 0.12,
        easing: Easing.bezier(0.7, 0, 0.84, 0), useNativeDriver: true, isInteraction: false }),
      Animated.delay(motion.themeReveal * 0.70),
      Animated.timing(progress, { toValue: 33, duration: motion.themeReveal * 0.18,
        easing: Easing.bezier(0.7, 0, 0.84, 0), useNativeDriver: true, isInteraction: false }),
    ]);
    animation.start(({ finished }) => { if (finished) onFinish(); });
    const timeout = setTimeout(onFinish, motion.themeReveal + motion.state);
    return () => { animation.stop(); frames.stop(); clearTimeout(timeout); };
  }, [onFinish, progress, frameClock, loaded, maskLoaded, reducedMotion]);
  useEffect(() => { const timeout = setTimeout(onFinish, motion.themeReveal + 1600); return () => clearTimeout(timeout); }, [onFinish]);
  return <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <View style={[styles.center, { opacity: 0, width, height }]}>
      {themeMaskFrames.map((source, index) => <Image key={index} source={source}
        onLoad={() => {
          loadedFrames.current.add(index);
          setMaskLoaded(loadedFrames.current.size);
        }} onError={onFinish} style={[styles.image, { width: size, height: size * 572 / 409 }]} />)}
    </View>
    <Image source={{ uri: previous }} onLoad={() => setLoaded((value) => value | 1)} style={[StyleSheet.absoluteFill, { width, height }]} resizeMode="stretch" />
    <MaskedView style={[StyleSheet.absoluteFill, { opacity: loaded === 3 && maskLoaded === themeMaskFrames.length ? 1 : 0 }]} androidRenderingMode="software"
      maskElement={<View style={[styles.center, { width, height }]}>
        <Animated.View style={[{ width: size, height: size * 572 / 409 }, maskStyle]}>
          {themeMaskFrames.map((source, index) => <Animated.Image key={index} source={source}
            onError={onFinish} resizeMode="contain" style={[styles.image, {
              opacity: frameClock.interpolate({
                inputRange: index === 0 ? [0, 0.999, 1] : [index - 0.001, index, index + 0.999, index + 1],
                outputRange: index === 0 ? [1, 1, 0] : [0, 1, 1, 0], extrapolate: 'clamp',
              }),
            }]} />)}
        </Animated.View>
      </View>}>
      <Image source={{ uri: next }} onLoad={() => setLoaded((value) => value | 2)} style={[StyleSheet.absoluteFill, { width, height }]} resizeMode="stretch" />
    </MaskedView>
  </View>;
}
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, image: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } });
