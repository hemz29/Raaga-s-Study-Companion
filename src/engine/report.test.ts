import { describe, expect, it } from 'vitest';
import { buildReport } from './report';
import { toCsv } from './csv';

describe('daily report', () => {
  it('leads with mistakes caught and includes specifics', () => {
    const r = buildReport({
      name: 'Raaga', dateLabel: 'Wed 28 Oct',
      blocks: [{ subject: 'Mathematics', chapter: 'Fractions', minutes: 25, exerciseTypes: ['Practice sums'] }],
      mistakes: [{ category: 'Wrong operator or number', note: 'used plus instead of minus, fixed it', subject: 'Mathematics' }],
      recallScore: 0.8, recallCount: 5, tomorrowRecall: ['Plassey'], stageName: 'Hatchling', moodLabel: 'very happy',
      playEarned: 25, playUsed: 10, lightDay: false, note: 'Fractions were fun',
    });
    expect(r.text.split('\n')[0]).toMatch(/caught 1 of her own mistake:/);
    expect(r.text).toContain('Recall quiz: 80%');
    expect(r.text).toContain("Tomorrow's recall: Plassey");
    expect(r.text).toContain('A note from Raaga: Fractions were fun');
    expect(r.subject).toContain('1 block');
  });
});

describe('csv', () => {
  it('escapes commas and quotes', () => {
    expect(toCsv([{ a: 'x, y', b: 'say "hi"' }])).toBe('a,b\n"x, y","say ""hi"""');
  });
});
