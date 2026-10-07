import { useEffect, useState } from 'react';
import type { LanguageId } from '@miithii/language-core-ts';
import { RoomEvent, type Room } from 'livekit-client';

import {
  applyPreview,
  createGuard,
  EMPTY_PREVIEW,
  parsePreview,
  REPLY_TOPIC,
  type ReplyPreview,
} from '../lib/replyPreview';

/**
 * Subscribes to the agent's text-first reply preview.
 *
 * The correlation rules live in `lib/replyPreview` so they can be tested without a room. This
 * hook is only the transport: subscribe, decode, apply.
 */
export function useReplyPreview(room: Room | undefined, language: LanguageId): ReplyPreview {
  const [preview, setPreview] = useState<ReplyPreview>(EMPTY_PREVIEW);

  useEffect(() => {
    if (!room) {
      setPreview(EMPTY_PREVIEW);
      return;
    }

    let disposed = false;
    let registered = false;
    let generation = 0;

    const detach = () => {
      // Invalidate a reader loop already inside `for await`; unregistering only prevents new
      // streams and cannot stop an existing async iterator from yielding one late chunk.
      generation += 1;
      if (registered) {
        room.unregisterTextStreamHandler(REPLY_TOPIC);
        registered = false;
      }
      if (!disposed) setPreview(EMPTY_PREVIEW);
    };

    const attach = () => {
      if (disposed || registered) return;
      const guard = createGuard(language, room.name);
      const readerGeneration = ++generation;

      room.registerTextStreamHandler(REPLY_TOPIC, (reader) => {
        void (async () => {
          try {
            for await (const chunk of reader) {
              if (disposed || readerGeneration !== generation) return;
              const message = parsePreview(chunk);
              if (!message) continue;
              // Connecting can precede the server assigning the Room's name. Resolve it at
              // receipt, before the first message is allowed to establish correlation.
              guard.roomName = room.name;
              setPreview((current) =>
                applyPreview(current, guard, {
                  ...message,
                  streamTimestamp: reader.info.timestamp,
                }),
              );
            }
          } catch {
            // Cancellation/disconnect is expected. A later Connected event installs a fresh
            // guard for the next logical session on this same Room object.
          }
        })();
      });
      registered = true;
      setPreview(EMPTY_PREVIEW);
    };

    const onConnected = () => attach();
    const onDisconnected = () => detach();
    // A reconnect can reuse the same Room object without a Disconnected event. Retire the old
    // async iterator at both signal/media recovery boundaries so a late chunk cannot become the
    // first message of the recovered reader's fresh turn. If recovery succeeds, attach below
    // with a fresh session guard and let the aligned transcript rebuild only what is evidenced.
    const onReconnecting = () => detach();
    const onSignalReconnecting = () => detach();
    const onReconnected = () => attach();

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.SignalReconnecting, onSignalReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);

    if (room.state !== 'disconnected') attach();
    else setPreview(EMPTY_PREVIEW);

    return () => {
      disposed = true;
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.SignalReconnecting, onSignalReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      detach();
    };
  }, [room, language]);

  return preview;
}
