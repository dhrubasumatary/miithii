import { LANGUAGE_OPTIONS } from '@miithii/language-core-ts';
import { useEffect, useRef } from 'react';
import { Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cue } from '../lib/haptics';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { Copy, ReplyLanguage } from '../theme/copy';
import { usePalette, useTheme } from '../theme/ThemeProvider';
import {
  family,
  motion,
  radius,
  space,
  type as typeScale,
} from '../theme/tokens';

/**
 * The language sheet.
 *
 * ## Why it is a sheet with a warning, and not two chips
 *
 * A language switch is not a toggle. The reply language is bound to the room, the agent's
 * policy, its LLM prompt and its voice for the whole session, so changing it ends the current
 * session and starts a new one. A chip in a header would hide that: it looks like a filter, and
 * a filter that silently ends your conversation is a betrayal of the interface.
 *
 * So the sheet says what is about to happen, in the same voice as everything else on the face,
 * and asks.
 *
 * ## The names are in their own script
 *
 * "Assamese" and "Bodo" are the English names of these languages. A speaker reads "অসমীয়া" or
 * "बरʼ" in the language's own script. The list therefore draws each
 * language's name in that language's own script, with the Latin name as a quiet second line
 * for anyone who needs it - never the other way around. Both come from the language pack, so
 * there is no second spelling of a language's name anywhere in the app.
 */
type LanguageSheetProps = {
  visible: boolean;
  current: ReplyLanguage;
  copy: Pick<Copy, 'languageTitle' | 'languageNote' | 'languageCancel'>;
  onPick: (language: ReplyLanguage) => void;
  onCancel: () => void;
};

const OPTIONS = LANGUAGE_OPTIONS.map((option) => ({
  code: option.id as ReplyLanguage,
  native: option.nativeLabel,
  latin: option.label,
}));

export function LanguageSheet({ visible, current, copy, onPick, onCancel }: LanguageSheetProps) {
  const rise = useRef(new Animated.Value(0)).current;

  // Every hook runs on every render, in the same order, whatever `visible` is. This hook used
  // to sit below `if (!visible) return null`, which made the hook count depend on the prop: the
  // first tap ran one hook, the next render ran two, and React correctly tore the tree down
  // with "change in the order of Hooks". An early return may only ever come *after* the last
  // hook - never before one.
  //
  // The sheet is absolutely positioned over the whole screen, so it covers the bottom safe area
  // and its last control would sit under the navigation bar. The inset is read here for that
  // reason, and it is also why this call has to be unconditional.
  const insets = useSafeAreaInsets();

  // The theme is read before the early return for the same reason as the inset: a hook that
  // only runs while the sheet is open changes the hook count between renders.
  const theme = useTheme();
  const palette = usePalette();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      rise.setValue(visible ? 1 : 0);
      return;
    }
    if (visible) rise.setValue(0);
    const animation = Animated.timing(rise, {
      toValue: visible ? 1 : 0,
      duration: visible ? motion.state : motion.snap,
      easing: visible ? Easing.bezier(0.23, 1, 0.32, 1) : Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [rise, visible, reduced]);

  // `Modal` used to own the Android back button. Without it the hardware back press would fall
  // through to the activity and close the app with the sheet still on screen, so the sheet takes
  // the key back itself - and only while it is actually open.
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => subscription.remove();
  }, [onCancel, visible]);

  if (!visible) return null;

  /**
   * This is deliberately an in-tree overlay and not a React Native `Modal`.
   *
   * A `Modal` on Android is a `Dialog` in its own window, and it is only torn down correctly if
   * it is mounted and then handed `visible: false` so the dismiss runs. The `if (!visible) return
   * null` above means this component mounted the `Dialog` already-visible and then unmounted it
   * without ever passing that edge, and a language pick makes it worse: the pick bumps the
   * runtime key, so the whole tree - sheet and all - is unmounted in the same commit.
   *
   * The result was not a visual glitch. The `Dialog` was dismissed without its bookkeeping and
   * Android never restored input dispatch for the app's window, so *every* control in the app
   * stopped responding - the control bar, the language chip, the reset - until the process was
   * restarted. A voice app that cannot be stopped is worse than one that can be started, and a
   * language switch must never be able to brick the interface.
   *
   * Nothing is given up by dropping it. The sheet is already a full-screen absolute backdrop with
   * a `Pressable` behind the panel, so it already covered the screen and already consumed the
   * taps meant for the page underneath. As a sibling it paints above everything `VoiceShell` has
   * drawn before it, and it leaves no window behind when it closes.
   */
  return (
    <View style={styles.backdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Close reply language menu"
      />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.surface.raised,
            borderColor: palette.hairline.strong,
            paddingBottom: space.xl + insets.bottom,
            transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [280, 0] }) }],
          },
        ]}
      >
        <Text style={[typeScale.title, styles.title, { fontFamily: family.mono, color: palette.text.bone }]}>
          {copy.languageTitle}
        </Text>
        <View style={[styles.rule, { backgroundColor: palette.hairline.faint }]} />
        <Text style={[styles.note, { fontFamily: family.mono, color: palette.text.muted }]}>{copy.languageNote}</Text>

        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const accent = theme.accent(option.code);
            const selected = option.code === current;
            return (
              <Pressable
                key={option.code}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.native}. ${option.latin}`}
                onPress={() => {
                  cue('listening');
                  onPick(option.code);
                }}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: palette.surface.well,
                    borderColor: selected ? accent.tint : palette.hairline.faint,
                  },
                  pressed && styles.optionPressed,
                ]}
              >
                <View style={styles.optionText}>
                  <Text
                    style={[
                      styles.native,
                      {
                        // A language's own face, so the name renders in the script it is
                        // written in rather than falling back to a system font.
                        fontFamily: option.code === 'brx' ? family.bodo : family.assamese,
                        fontWeight: option.code === 'brx' ? '600' : '400',
                        color: selected ? accent.tint : palette.text.body,
                      },
                    ]}
                  >
                    {option.native}
                  </Text>
                  <Text style={[styles.latin, { fontFamily: family.mono, color: palette.text.muted }]}>{option.latin}</Text>
                </View>
                {/* The selected mark is a filled square, not a ring: same language as the
                    logo's lit centre bar and the status lamp. */}
                {selected ? (
                  <View style={[styles.mark, { backgroundColor: accent.tint }]} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.languageCancel}
          onPress={onCancel}
          style={({ pressed }) => [styles.cancel, pressed && styles.cancelPressed]}
        >
          <Text style={[typeScale.control, styles.cancelText, { fontFamily: family.mono, color: palette.text.bone }]}>
            {copy.languageCancel}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    // Explicitly above the backdrop. The backdrop is an absolutely-positioned first child and
    // the sheet is a normal-flow second child of the same view, and in this tree Android
    // composites the absolute sibling last - so it covered the panel and swallowed every tap on
    // the options and on Cancel. Inside a `Modal` the ordering came out right by accident, which
    // is why moving in-tree exposed it. Saying so here is what actually makes it correct.
    zIndex: 1,
  },
  title: {
    letterSpacing: 1.4,
  },
  rule: {
    height: 1,
    marginTop: space.md,
  },
  note: {
    ...typeScale.caption,
    marginTop: space.md,
    marginBottom: space.lg,
  },
  options: {
    gap: space.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 68,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  optionPressed: {
    opacity: 0.7,
  },
  optionText: {
    flex: 1,
  },
  native: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
    includeFontPadding: false,
  },
  latin: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 2,
  },
  mark: {
    width: 10,
    height: 10,
  },
  cancel: {
    marginTop: space.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPressed: {
    opacity: 0.6,
  },
  cancelText: {
  },
});
