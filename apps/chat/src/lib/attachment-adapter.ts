"use client";

import type {
  Attachment,
  AttachmentAdapter,
  CompleteAttachment,
  PendingAttachment,
} from "@assistant-ui/react";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const UPLOAD_PATH_RE = /^\/api\/uploads\/[a-f0-9-]{36}$/;

export const CHAT_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

export type ApiTokenGetter = () => Promise<string | null>;

type UploadResponse = {
  id?: unknown;
  url?: unknown;
  mediaType?: unknown;
};

const messageFromResponse = async (response: Response) => {
  const body = (await response.clone().json().catch(() => null)) as
    | { error?: { message?: unknown } | string; message?: unknown }
    | null;

  if (typeof body?.error === "string") return body.error;
  if (
    body?.error &&
    typeof body.error === "object" &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }
  if (typeof body?.message === "string") return body.message;
  if (response.status === 413) return "That image is too large. Use an image under 5 MB.";
  if (response.status === 415) return "Use a PNG, JPEG, or WebP image.";
  if (response.status === 429) return "Too many uploads right now. Try again shortly.";
  return "Image upload failed. Please try again.";
};

const uploadReference = (attachment: Attachment) => {
  for (const part of attachment.content ?? []) {
    if (
      part.type === "file" &&
      typeof part.data === "string" &&
      UPLOAD_PATH_RE.test(part.data)
    ) {
      return part.data;
    }
    if (
      part.type === "image" &&
      typeof part.image === "string" &&
      UPLOAD_PATH_RE.test(part.image)
    ) {
      return part.image;
    }
  }
  return null;
};

export function createChatImageAttachmentAdapter(
  getApiToken: ApiTokenGetter,
  apiBaseUrl = "",
): AttachmentAdapter {
  const endpoint = (path: string) => `${apiBaseUrl}${path}`;

  return {
    accept: CHAT_IMAGE_ACCEPT,

    async add({ file }): Promise<PendingAttachment> {
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        throw new Error("Use a PNG, JPEG, or WebP image.");
      }
      if (file.size <= 0) throw new Error("That image is empty.");
      if (file.size > MAX_IMAGE_BYTES) {
        throw new Error("That image is too large. Use an image under 5 MB.");
      }

      return {
        id: crypto.randomUUID(),
        type: "image",
        name: file.name || "image",
        contentType: file.type,
        file,
        status: { type: "requires-action", reason: "composer-send" },
      };
    },

    async send(attachment): Promise<CompleteAttachment> {
      const token = await getApiToken();
      if (!token) throw new Error("Sign in again before uploading an image.");

      const response = await fetch(endpoint("/api/uploads"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": attachment.contentType || attachment.file.type,
        },
        body: attachment.file,
      });
      if (!response.ok) throw new Error(await messageFromResponse(response));

      const payload = (await response.json()) as UploadResponse;
      if (
        typeof payload.url !== "string" ||
        !UPLOAD_PATH_RE.test(payload.url) ||
        typeof payload.mediaType !== "string" ||
        !ACCEPTED_IMAGE_TYPES.has(payload.mediaType)
      ) {
        throw new Error("Image upload returned an invalid reference.");
      }

      return {
        ...attachment,
        contentType: payload.mediaType,
        status: { type: "complete" },
        // The browser only stores this opaque, account-scoped reference. The
        // API resolves it from private R2 after Clerk identity validation.
        content: [
          {
            type: "file",
            data: payload.url,
            mimeType: payload.mediaType,
            filename: attachment.name,
            sourceType: "id",
          },
        ],
      };
    },

    async remove(attachment) {
      const path = uploadReference(attachment);
      if (!path) return;
      const token = await getApiToken();
      if (!token) return;
      await fetch(endpoint(path), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    },
  };
}
