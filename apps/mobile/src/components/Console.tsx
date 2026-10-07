import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { cue } from '../lib/haptics';
import { usePalette } from '../theme/ThemeProvider';
import { family, familyFor, space, type as typeScale, voiceLayout } from '../theme/tokens';
import { ThemeSwitch } from './ThemeSwitch';
export type ControlPhase = 'off' | 'connecting' | 'live' | 'ending';

export function MicIcon({ color, muted = false }: { color: string; muted?: boolean }) {
  return <View accessible={false} style={styles.mic}>
    <View style={[styles.capsule, { backgroundColor: color }]} />
    <View style={[styles.cradle, { borderColor: color }]} />
    <View style={[styles.stem, { backgroundColor: color }]} />
    {muted ? <View style={[styles.slash, { backgroundColor: color }]} /> : null}
  </View>;
}

export function ControlBar({ accent, phase, label, disabled = false, onStart, onEnd }: {
  accent: string; phase: ControlPhase; label: string; disabled?: boolean;
  onStart: () => void; onEnd: () => void;
}) {
  const palette = usePalette();
  const live = phase === 'live';
  const busy = phase === 'ending';
  const inactive = disabled || busy;
  const foreground = inactive ? palette.text.absent : live ? palette.text.bone : palette.surface.ink;
  return <View style={styles.primaryWrap}>
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityHint={phase === 'connecting' ? 'Cancels the connection attempt.' : live ? 'Ends voice and keeps your transcript.' : 'Starts voice.'}
      accessibilityState={{ disabled: inactive, busy }} disabled={inactive}
      onPress={() => { cue(live ? 'interrupted' : 'listening'); if (live) onEnd(); else onStart(); }}
      style={({ pressed }) => [styles.primary, { backgroundColor: inactive ? palette.surface.control : live ? palette.surface.control : accent,
        borderColor: live ? palette.hairline.strong : 'transparent', opacity: pressed ? 0.7 : 1 }]}>
      {live || phase === 'connecting' || busy ? <View style={[styles.stop, { backgroundColor: foreground }]} />
        : <MicIcon color={foreground} />}
    </Pressable>
    <Text style={[styles.primaryLabel, { color: palette.text.muted }]}>{busy ? 'Ending' : phase === 'connecting' ? 'Cancel' : live ? 'End' : label.includes('AGAIN') ? 'Retry' : 'Start'}</Text>
  </View>;
}

export function Header({ language, languageName, latinName, accent, languageEnabled, onPressLanguage }: {
  language: string; languageName: string; latinName: string; accent: string;
  languageEnabled: boolean; onPressLanguage: () => void;
}) {
  const palette = usePalette();
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel={'Reply language: ' + latinName + '. Change reply language.'}
      accessibilityHint="Changing language starts a new conversation." accessibilityState={{ disabled: !languageEnabled }}
      disabled={!languageEnabled} onPress={() => { cue('listening'); onPressLanguage(); }}
      style={({ pressed }) => [styles.language, { backgroundColor: pressed ? palette.surface.controlPressed : 'transparent' }]}>
      <Text style={[styles.languageName, { fontFamily: familyFor(language), color: languageEnabled ? accent : palette.text.absent,
        fontWeight: language === 'brx' ? '600' : '400' }]}>{languageName}</Text>
      <View accessible={false} style={[styles.arrow, { borderColor: languageEnabled ? accent : palette.text.absent }]} />
    </Pressable>
    <ThemeSwitch />
  </View>;
}

export function ResetControl({ label, enabled, onReset }: { label: string; enabled: boolean; onReset: () => void }) {
  const palette = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint="Asks before clearing the conversation and ending voice." accessibilityState={{ disabled: !enabled }}
    disabled={!enabled} onPress={() => Alert.alert('Clear conversation?', 'This removes the transcript and ends voice.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: onReset }])}
    style={({ pressed }) => [styles.secondary, { backgroundColor: pressed ? palette.surface.controlPressed : palette.surface.control }]}>
    <View accessible={false} style={[styles.bin, { borderColor: palette.text.muted }]}>
      <View style={[styles.binLid, { backgroundColor: palette.text.muted }]} />
      <View style={[styles.binHandle, { borderColor: palette.text.muted }]} />
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.sm },
  language: { width: voiceLayout.languageWidth, height: 48, flexDirection: 'row', alignItems: 'center', gap: space.md },
  languageName: { fontSize: 16, lineHeight: 26 },
  arrow: { width: 8, height: 8, borderRightWidth: 1.5, borderBottomWidth: 1.5, transform: [{ rotate: '45deg' }], marginBottom: 4 },
  primaryWrap: { alignItems: 'center', gap: space.sm }, primary: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { ...typeScale.caption, fontFamily: family.mono, minHeight: 18 }, stop: { width: 20, height: 20, borderRadius: 3 },
  secondary: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  mic: { width: 24, height: 28, alignItems: 'center' }, capsule: { width: 10, height: 17, borderRadius: 5 },
  cradle: { position: 'absolute', top: 8, width: 20, height: 15, borderWidth: 2, borderTopWidth: 0, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  stem: { position: 'absolute', bottom: 0, height: 6, width: 2 }, slash: { position: 'absolute', width: 30, height: 2, top: 13, transform: [{ rotate: '-45deg' }] },
  bin: { width: 14, height: 17, borderWidth: 1.5, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  binLid: { position: 'absolute', top: -4, left: -4, width: 19, height: 1.5 }, binHandle: { position: 'absolute', top: -8, left: 2, width: 7, height: 4, borderWidth: 1.5, borderBottomWidth: 0 },
});

