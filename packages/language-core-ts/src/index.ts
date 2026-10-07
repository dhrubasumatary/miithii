import compiled from '@miithii/language-packs/compiled/language-packs.json' with { type: 'json' };

export type LanguageId = keyof typeof compiled.languages;

export type LanguageOption = Readonly<{
  id: LanguageId;
  label: string;
  nativeLabel: string;
  packVersion: string;
  reviewStatus: 'draft' | 'reviewed' | 'shipped';
}>;

export const DEFAULT_LANGUAGE_ID = compiled.defaultLanguage as LanguageId;
export const SEGMENTATION_RULES = compiled.segmentation;

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = Object.values(compiled.languages)
  .filter((pack) => pack.enabledForDevelopment)
  .map((pack) => ({
    id: pack.id as LanguageId,
    label: pack.names.english,
    nativeLabel: pack.names.native,
    packVersion: pack.version,
    reviewStatus: pack.review.status as LanguageOption['reviewStatus'],
  }));

export function normalizeLanguageId(value: string): LanguageId {
  const normalized = value.trim().toLowerCase();
  const canonical = compiled.aliases[normalized as keyof typeof compiled.aliases];
  if (!canonical || !(canonical in compiled.languages)) {
    throw new Error(`Unsupported Miithii reply language: ${value}`);
  }
  return canonical as LanguageId;
}

export function languageOption(id: LanguageId): LanguageOption {
  const option = LANGUAGE_OPTIONS.find((item) => item.id === id);
  if (!option) throw new Error(`Language ${id} is not enabled for this build`);
  return option;
}
