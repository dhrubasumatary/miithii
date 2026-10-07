import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics are a voice channel.
 *
 * The argument for them here is not decoration. Miithii is an audio app that the user often
 * cannot look at - walking, holding a bag, phone in a pocket - and every other piece of
 * feedback in the turn is visual. Haptics are the only way the app can say something with
 * zero attention on it.
 *
 * The single most valuable cue is `sentence`: a tick when each new sentence of the reply
 * starts being spoken. That gives the reply a rhythm you can feel. A user who is not watching
 * the screen still knows how long the answer is, and roughly where they are in it, without a
 * single word of English or Assamese being needed. For an app whose whole point is to be
 * usable in a second language, that is an accessibility feature rather than a flourish.
 *
 * Two platform facts constrain the design, both verified against the Expo SDK 57 sources:
 *
 * `expo-vibration` is gone. It is unpublished from npm, not merely deprecated, so there is no
 * long buzz to reach for. Every cue here is a short tap.
 *
 * `impactAsync`, `notificationAsync` and `selectionAsync` all go through `Vibrator.vibrate()`,
 * which needs `android.permission.VIBRATE` - and that permission is deliberately blocked in
 * `app.json`, because a voice app has no business shaking the phone for thirty seconds.
 * `performAndroidHapticsAsync` goes through `View.performHapticFeedback()` instead, which
 * needs no permission and drives the real haptics engine. So on Android only the `android`
 * channel is used, and every cue below has a defined meaning on it.
 *
 * The vocabulary is short on purpose. A cue whose meaning nobody can recall is a cue that
 * teaches nothing, and the whole point of this file is that each one means exactly one thing.
 */
export type HapticCue =
  /** A control was taken up: a press, or the language sheet opening. */
  | 'listening'
  /** A new sentence of the reply has started being spoken. */
  | 'sentence'
  | 'preparing'
  | 'waiting'
  | 'interrupted'
  /** Something destructive was committed. */
  | 'refused';

/**
 * The Android haptics constant each cue maps to.
 *
 * These are chosen for what the user is being told, not for how strong they feel:
 *
 * `confirm` is the pair of taps Android uses for "this registered". It is the only one that
 * feels like an acknowledgement rather than an event, which is why it carries `listening`.
 *
 * `segment-frequent-tick` is a single very light click. A sentence boundary is the most
 * frequent thing this app signals, so it has to be the least intrusive thing it can signal.
 *
 * `reject` is a double tap in the pattern Android uses for a refused action.
 */
const ANDROID_CUE: Record<HapticCue, Haptics.AndroidHaptics> = {
  listening: Haptics.AndroidHaptics.Confirm,
  sentence: Haptics.AndroidHaptics.Segment_Frequent_Tick,
  preparing: Haptics.AndroidHaptics.Segment_Tick,
  waiting: Haptics.AndroidHaptics.Clock_Tick,
  interrupted: Haptics.AndroidHaptics.Gesture_End,
  refused: Haptics.AndroidHaptics.Reject,
};

/**
 * Fire a cue.
 *
 * Every call is fire-and-forget. A haptic that is slightly late is fine; a haptic that blocks
 * the turn is not. Failures are swallowed deliberately: a device with no haptics engine, a
 * user who has turned them off in system settings, and a cue fired in the moment the engine
 * is being torn down all look the same from here, and none of them are worth an error the user
 * would have to read.
 */
export function cue(name: HapticCue): void {
  const android = ANDROID_CUE[name];

  try {
    if (Platform.OS === 'android') {
      // `performAndroidHapticsAsync` is the only Android path that needs no permission and
      // the only one that drives the real haptics engine rather than the raw motor.
      void Haptics.performAndroidHapticsAsync(android);
      return;
    }

    if (name === 'refused') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (name === 'sentence') {
      void Haptics.selectionAsync();
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // See above: an engine that is absent, disabled, or mid-teardown is not an error.
  }
}
