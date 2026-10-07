export const OPERATION_BOUND_MS = 15000;

/** A stale completion cannot release a newer operation's controls. */
export function createOperationBound(onRelease: () => void, boundMs = OPERATION_BOUND_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const release = (expected = generation) => {
    if (expected !== generation) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    onRelease();
  };
  return {
    hold() {
      if (timer !== undefined) clearTimeout(timer);
      const current = ++generation;
      timer = setTimeout(() => release(current), boundMs);
      return () => release(current);
    },
    release,
    dispose() {
      generation += 1;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}
