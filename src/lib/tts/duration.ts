import { LanguageProfile } from "./types";

export function estimateDurationSeconds(text: string, profile: LanguageProfile): number {
  const clean = text.trim();
  if (!clean) return 0;
  const words = clean.split(/\s+/g).filter(Boolean).length;
  const useCharFallback = words < Math.max(4, Math.floor(clean.length / 18));
  if (!useCharFallback) return Math.max(1, Math.round((words / profile.estimatedWpm) * 60));
  const approxWords = Math.ceil(clean.length / 5.2);
  return Math.max(1, Math.round((approxWords / profile.estimatedWpm) * 60));
}
