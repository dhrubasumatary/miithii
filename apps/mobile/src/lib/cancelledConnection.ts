/** Keep a cancelled start disconnected while the SDK's token request settles. */
export function guardCancelledConnection(
  signal: AbortSignal,
  subscribe: (listener: (state: string) => void) => () => void,
  disconnect: () => Promise<void>,
): () => void {
  const close = () => { void disconnect().catch(() => undefined); };
  const unsubscribe = subscribe((state) => {
    if (signal.aborted && state !== 'disconnected') close();
  });
  signal.addEventListener('abort', close);
  if (signal.aborted) close();
  return () => {
    signal.removeEventListener('abort', close);
    unsubscribe();
  };
}
