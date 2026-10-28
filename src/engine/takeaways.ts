import type { SubjectKind } from '../types';
import { config } from '../config';

export interface TakeawayCheck {
  ok: boolean;
  reason?: 'empty' | 'short' | 'anchor' | 'duplicate' | 'near-duplicate' | 'repeat';
  coach?: string;
}

const KEYWORD_ANCHORS = [
  /\bbecause\b/i, /\bso that\b/i, /\btherefore\b/i, /\bwhich means\b/i,
  /\bis called\b/i, /\bare called\b/i, /\bknown as\b/i, /\bdefined as\b/i, /=/,
  /\d/, // any digit: numbers, years, H2O, 3x
  // units of measurement are concrete too
  /\b(kilo|centi|milli)?(gram|metre|meter|litre|liter)s?\b/i, /\b(newton|joule|watt|kelvin|celsius|degree)s?\b/i, /°/,
];

export function words(text: string): string[] {
  return text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
}

export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

/** Capitalised words that are probably proper names (not the sentence's first word, not "I"). */
export function properNouns(text: string): string[] {
  const out: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const ws = words(s);
    ws.forEach((raw, i) => {
      const w = raw.replace(/^[^\p{L}]+|[^\p{L}\p{N}]+$/gu, '');
      if (!w || w === 'I') return;
      const isAcronym = /^\p{Lu}{2,}\d*$/u.test(w);
      const isCap = /^\p{Lu}\p{Ll}/u.test(w);
      if (isAcronym) out.push(w);
      else if (isCap && i > 0) out.push(w);
      else if (isCap && i === 0 && ws[1] && /^\p{Lu}\p{Ll}/u.test(ws[1])) out.push(w); // "Chandragupta Maurya ..."
    });
  }
  return out;
}

const TITLE_STOPWORDS = new Set(['and', 'the', 'with', 'from', 'into', 'their', 'your', 'introduction', 'chapter', 'unit', 'part', 'basics']);

/** Key terms from a chapter title ("The Harappan Civilisation" -> harappan, civilisation). */
export function keyTermsFrom(title?: string): string[] {
  if (!title) return [];
  return normalise(title).split(' ').filter((w) => w.length >= 4 && !TITLE_STOPWORDS.has(w));
}

export function hasAnchor(text: string, keyTerms: string[] = []): boolean {
  if (KEYWORD_ANCHORS.some((re) => re.test(text)) || properNouns(text).length > 0) return true;
  const ws = new Set(normalise(text).split(' '));
  return keyTerms.some((k) => ws.has(k));
}

export function similarity(a: string, b: string): number {
  const A = new Set(normalise(a).split(' ').filter(Boolean));
  const B = new Set(normalise(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => { if (B.has(w)) inter++; });
  return inter / (A.size + B.size - inter);
}

export function coachFor(kind: SubjectKind): string {
  switch (kind) {
    case 'memory': return 'Ooh, which year? Who was involved, or where did it happen?';
    case 'maths': return 'Which number or rule? Try adding a tiny example, like 3 × 4 = 12.';
    case 'science': return 'Why does it happen? Try finishing with "because…", or add a name or number.';
    case 'language': return 'Which word, character or example? Name it!';
    default: return 'Can you add a name, a number, or a "because"?';
  }
}

/**
 * Check one takeaway. `siblings` are the other points in the same block,
 * `previous` are takeaways logged on earlier blocks (to stop copy-repeats),
 * `keyTerms` are words from the chapter title, which also count as concrete anchors.
 */
export function checkTakeaway(
  text: string,
  kind: SubjectKind,
  siblings: string[] = [],
  previous: string[] = [],
  keyTerms: string[] = [],
): TakeawayCheck {
  const t = text.trim();
  if (!t) return { ok: false, reason: 'empty' };
  if (words(t).length < config.gate.minWordsPerTakeaway) {
    return { ok: false, reason: 'short', coach: `Stretch it into a full thought: at least ${config.gate.minWordsPerTakeaway} words.` };
  }
  const n = normalise(t);
  if (siblings.some((s) => normalise(s) === n)) {
    return { ok: false, reason: 'duplicate', coach: 'You already wrote this one! What else did you learn?' };
  }
  if (previous.some((s) => normalise(s) === n)) {
    return { ok: false, reason: 'repeat', coach: 'This one is from an earlier day. Find something new from today!' };
  }
  if (siblings.some((s) => s.trim() && similarity(s, t) >= config.gate.nearDuplicateThreshold)) {
    return { ok: false, reason: 'near-duplicate', coach: 'That is very close to another point. Can you make it a different fact?' };
  }
  if (!hasAnchor(t, keyTerms)) return { ok: false, reason: 'anchor', coach: coachFor(kind) };
  return { ok: true };
}
