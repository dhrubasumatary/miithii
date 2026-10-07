import { createContext, useContext, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { ThemeTransition } from '../components/ThemeTransition';
import { CoverReadiness } from './coverReadiness';
import { DEFAULT_THEME_MODE, accentFor, palettes, type Accent, type Palette, type ThemeMode } from './tokens';

const ThemeContext = createContext<{
  mode: ThemeMode; palette: Palette; accent: (language: string) => Accent;
  setMode: (mode: ThemeMode) => void; toggle: () => void; transitioning: boolean;
  holdScreen: (change: () => void) => void;
} | null>(null);

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, commitMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [frames, setFrames] = useState<{ id: number; previous: string; next: string | null } | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const screen = useRef<View>(null);
  const busy = useRef(false);
  const coverReadiness = useRef(new CoverReadiness());
  const modeReady = useRef<(() => void) | null>(null);
  useLayoutEffect(() => { modeReady.current?.(); modeReady.current = null; }, [mode]);
  const showCover = useCallback((previous: string) => {
    const { id, ready } = coverReadiness.current.begin(1200);
    setFrames({ id, previous, next: null });
    return ready;
  }, []);
  const reduced = useReducedMotion();
  const finish = useCallback(() => {
    setFrames((current) => {
      if (current) { releaseCapture(current.previous); if (current.next) releaseCapture(current.next); }
      return null;
    });
    busy.current = false;
    setTransitioning(false);
  }, []);
  const setMode = useCallback((next: ThemeMode) => {
    if (next === mode || busy.current) return;
    if (reduced) { commitMode(next); return; }
    busy.current = true;
    setTransitioning(true);
    void (async () => {
      let previous: string | undefined;
      let following: string | undefined;
      try {
        previous = await captureRef(screen, { format: 'png', result: 'tmpfile' });
        const coverId = await showCover(previous);
        await nextFrame(); await nextFrame();
        await new Promise<void>((resolve) => { modeReady.current = resolve; commitMode(next); });
        await nextFrame(); await nextFrame();
        following = await captureRef(screen, { format: 'png', result: 'tmpfile' });
        setFrames({ id: coverId, previous, next: following });
      } catch {
        if (previous) releaseCapture(previous);
        if (following) releaseCapture(following);
        setFrames(null);
        commitMode(next);
        busy.current = false;
        setTransitioning(false);
      }
    })();
  }, [mode, reduced, showCover]);
  const holdScreen = useCallback((change: () => void) => {
    if (busy.current) return;
    busy.current = true;
    setTransitioning(true);
    void (async () => {
      let previous: string | undefined;
      try { previous = await captureRef(screen, { format: 'png', result: 'tmpfile' }); }
      catch { /* A capture failure must not prevent changing language. */ }
      if (previous) await showCover(previous);
      change();
      await nextFrame(); await nextFrame();
      finish();
    })();
  }, [finish, showCover]);
  const value = useMemo(() => ({ mode, palette: palettes[mode],
    accent: (language: string) => accentFor(language, mode), setMode,
    toggle: () => setMode(mode === 'dark' ? 'light' : 'dark'), transitioning, holdScreen,
  }), [mode, setMode, transitioning, holdScreen]);
  return <ThemeContext.Provider value={value}>
    <View style={styles.root}>
      <View ref={screen} collapsable={false} style={styles.root}>{children}</View>
      {frames ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image source={{ uri: frames.previous }} onLoad={() => coverReadiness.current.complete(frames.id)} onError={() => coverReadiness.current.complete(frames.id)} style={StyleSheet.absoluteFill} resizeMode="stretch" />
        {frames.next ? <ThemeTransition previous={frames.previous} next={frames.next} reducedMotion={reduced} onFinish={finish} /> : null}
      </View> : null}
    </View>
  </ThemeContext.Provider>;
}
export function useTheme() {
  return useContext(ThemeContext) ?? {
    mode: DEFAULT_THEME_MODE, palette: palettes[DEFAULT_THEME_MODE],
    accent: (language: string) => accentFor(language, DEFAULT_THEME_MODE),
    setMode: (_mode: ThemeMode) => undefined, toggle: () => undefined, transitioning: false,
    holdScreen: (change: () => void) => change(),
  };
}
export function usePalette(): Palette { return useTheme().palette; }
export function useAccent(language: string): Accent { return useTheme().accent(language); }
export { ThemeContext };
export type { ThemeMode };
const styles = StyleSheet.create({ root: { flex: 1 } });
