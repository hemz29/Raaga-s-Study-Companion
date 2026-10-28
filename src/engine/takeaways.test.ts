import { describe, expect, it } from 'vitest';
import { checkTakeaway, hasAnchor, keyTermsFrom, properNouns, similarity } from './takeaways';

describe('takeaway specificity checks', () => {
  it('accepts a point with a year', () => {
    expect(checkTakeaway('The Battle of Plassey was fought in 1757', 'memory').ok).toBe(true);
  });
  it('accepts a point with a proper name mid-sentence', () => {
    expect(checkTakeaway('The great emperor Ashoka spread the message of peace', 'memory').ok).toBe(true);
  });
  it('accepts a point with because', () => {
    expect(checkTakeaway('leaves look green because they contain lots of chlorophyll', 'science').ok).toBe(true);
  });
  it('accepts chemical formulae via digits', () => {
    expect(checkTakeaway('the chemical formula of water is H2O always', 'science').ok).toBe(true);
  });
  it('rejects short points', () => {
    const r = checkTakeaway('Ashoka was kind', 'memory');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('short');
  });
  it('rejects vague points and coaches by subject', () => {
    const r = checkTakeaway('the king was very kind to all the people', 'memory');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('anchor');
    expect(r.coach).toMatch(/year/i);
  });
  it('does not count the first word of a sentence as a proper noun', () => {
    expect(properNouns('Water is very good for all of us')).toEqual([]);
    expect(hasAnchor('Water is very good for all of us')).toBe(false);
  });
  it('counts two capitalised words at the start as a name', () => {
    expect(properNouns('Chandragupta Maurya founded an empire')).toContain('Chandragupta');
  });
  it('blocks duplicates in the same block', () => {
    const t = 'The Harappan cities had great drains in 2500 BC';
    expect(checkTakeaway(t, 'memory', [t.toUpperCase()]).reason).toBe('duplicate');
  });
  it('blocks near-duplicates in the same block', () => {
    const a = 'The Harappan people built cities with great drains in 2500 BC';
    const b = 'The Harappan people built cities with good drains in 2500 BC';
    expect(similarity(a, b)).toBeGreaterThan(0.7);
    expect(checkTakeaway(b, 'memory', [a]).reason).toBe('near-duplicate');
  });
  it('blocks repeats from earlier days', () => {
    const t = 'The Mauryan Empire was founded in 321 BC';
    expect(checkTakeaway(t, 'memory', [], [t]).reason).toBe('repeat');
  });
  it('counts units of measurement as anchors', () => {
    expect(checkTakeaway('Mass is measured in kilograms using a beam balance', 'science').ok).toBe(true);
  });
  it('counts chapter-title key terms as anchors', () => {
    const t = 'Harappan seals showed animals like the unicorn bull and had a script';
    expect(checkTakeaway(t, 'memory').ok).toBe(false);
    expect(keyTermsFrom('The Harappan Civilisation')).toEqual(['harappan', 'civilisation']);
    expect(checkTakeaway(t, 'memory', [], [], keyTermsFrom('The Harappan Civilisation')).ok).toBe(true);
  });
});
