export type UploadPurpose = "subtitle-source" | "voice-sample" | "chat-attachment";

export type UploadPolicy = {
  purpose: UploadPurpose;
  maxBytes: number;
  allowedMimeTypes: string[];
};

export const uploadPolicies: Record<UploadPurpose, UploadPolicy> = {
  "subtitle-source": {
    purpose: "subtitle-source",
    maxBytes: 1024 * 1024 * 512,
    allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/webm", "video/mp4", "video/webm"]
  },
  "voice-sample": {
    purpose: "voice-sample",
    maxBytes: 1024 * 1024 * 64,
    allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/webm"]
  },
  "chat-attachment": {
    purpose: "chat-attachment",
    maxBytes: 1024 * 1024 * 32,
    allowedMimeTypes: ["application/pdf", "text/plain", "image/png", "image/jpeg"]
  }
};

export function getUploadPolicy(purpose: UploadPurpose) {
  return uploadPolicies[purpose];
}

