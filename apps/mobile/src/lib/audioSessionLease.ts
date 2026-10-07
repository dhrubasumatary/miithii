/** Serializes the shared native audio device; retired rooms cannot stop its new owner. */
export function createAudioSessionLeases(device: { start: () => Promise<void>; stop: () => Promise<void> }) {
  let owner: symbol | null = null;
  let pending: Promise<void> = Promise.resolve();
  const serialize = (operation: () => Promise<void>) => {
    const result = pending.then(operation);
    pending = result.catch(() => undefined);
    return result;
  };
  return {
    claim: (next: symbol) => serialize(async () => {
      if (owner === next) return;
      if (owner !== null) { await device.stop(); owner = null; }
      await device.start();
      owner = next;
    }),
    release: (previous: symbol) => serialize(async () => {
      if (owner !== previous) return;
      await device.stop();
      owner = null;
    }),
  };
}
