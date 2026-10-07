import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the system has asked for reduced motion.
 *
 * The setting is
 * `Settings -> Accessibility -> Remove animations` on Android 9+, exposed here as
 * `AccessibilityInfo.isReduceMotionEnabled()`.
 *
 * Every animated surface in the app reads this rather than owning a listener, because a
 * surface that forgets to check is the normal way this setting stops being honoured.
 *
 * It is a live subscription, not a one-shot read: a user can turn it on while the app is
 * open, and a voice session is exactly when someone is most likely to be fiddling with
 * device settings.
 */
export function useReducedMotion(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setEnabled(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
