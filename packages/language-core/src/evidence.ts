import type { InputModality, LanguageId, ReplyScript } from './types.ts';

export type EvidenceKind = 'observed-use' | 'assisted-use' | 'correction';

export interface EvidenceFragment {
  id: string;
  text: string;
  language: LanguageId;
  script: ReplyScript;
  modality: InputModality;
}

export interface EvidenceSourceRef {
  id: string;
  revisionKey: string;
}

export interface EvidenceProposal {
  kind: EvidenceKind;
  quote: string;
  language: LanguageId;
  script: ReplyScript;
  modality: InputModality;
  sources: EvidenceSourceRef[];
}

export interface ValidatedEvidence extends EvidenceProposal {
  validated: true;
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function fragmentRevisionKey(fragment: Pick<EvidenceFragment, 'id' | 'text' | 'language' | 'script' | 'modality'>): string {
  return `v1:${fnv1a(`${fragment.id}\u0000${fragment.text}\u0000${fragment.language}\u0000${fragment.script}\u0000${fragment.modality}`)}`;
}

export function validateEvidenceProposal(proposal: EvidenceProposal, fragments: readonly EvidenceFragment[]): ValidatedEvidence | null {
  if (!proposal.quote || proposal.quote.length > 1000 || proposal.sources.length < 1 || proposal.sources.length > 8) return null;
  const byId = new Map(fragments.map(fragment => [fragment.id, fragment]));
  const seen = new Set<string>();
  let exactQuoteFound = false;

  for (const source of proposal.sources) {
    if (seen.has(source.id)) return null;
    seen.add(source.id);
    const fragment = byId.get(source.id);
    if (!fragment || fragmentRevisionKey(fragment) !== source.revisionKey) return null;
    if (fragment.language !== proposal.language || fragment.script !== proposal.script || fragment.modality !== proposal.modality) return null;
    if (fragment.text.includes(proposal.quote)) exactQuoteFound = true;
  }

  if (!exactQuoteFound) return null;
  return { ...proposal, sources: proposal.sources.map(source => ({ ...source })), validated: true };
}
