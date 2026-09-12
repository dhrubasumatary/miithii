"use client";

import { useEffect, useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { useAuth } from "@clerk/clerk-react";
import { useShallow } from "zustand/react/shallow";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const PRIVATE_UPLOAD_RE = /^\/api\/uploads\/[a-f0-9-]{36}$/;

const useFileSrc = (file: File | undefined) => {
  const [entry, setEntry] = useState<{ file: File; url: string } | undefined>(
    undefined,
  );

  useEffect(() => {
    // The object URL is a browser resource whose lifetime has to straddle
    // commit, so allocation, revocation, and clearing the entry that names a
    // revoked URL all belong to the effect.
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntry(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setEntry({ file, url: objectUrl });

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return entry !== undefined && entry.file === file ? entry.url : undefined;
};

const usePrivateImageSrc = (src: string | undefined) => {
  const { getToken } = useAuth();
  const [entry, setEntry] = useState<{ src: string; url: string }>();

  useEffect(() => {
    if (!src || !PRIVATE_UPLOAD_RE.test(src)) {
      setEntry(undefined);
      return;
    }

    let cancelled = false;
    let objectUrl: string | undefined;
    void (async () => {
      const token = await getToken({ template: "miithii-api" });
      if (!token || cancelled) return;
      const response = await fetch(`${apiBaseUrl}${src}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok || cancelled) return;
      objectUrl = URL.createObjectURL(await response.blob());
      if (cancelled) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = undefined;
        return;
      }
      setEntry({ src, url: objectUrl });
    })().catch(() => {
      if (!cancelled) setEntry(undefined);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [getToken, src]);

  return entry && entry.src === src ? entry.url : undefined;
};

export const useAttachmentSrc = () => {
  const { file, src } = useAuiState(
    useShallow((s): { file?: File; src?: string } => {
      if (s.attachment.type !== "image") return {};
      if (s.attachment.file) return { file: s.attachment.file };
      const src = s.attachment.content?.filter((c) => c.type === "image")[0]
        ?.image;
      if (!src) return {};
      return { src };
    }),
  );

  const localSrc = useFileSrc(file);
  const privateSrc = usePrivateImageSrc(src);
  return localSrc ?? (src && PRIVATE_UPLOAD_RE.test(src) ? privateSrc : src);
};
