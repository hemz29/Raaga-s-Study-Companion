export interface ReportInput {
  name: string;
  dateLabel: string;
  blocks: { subject: string; chapter?: string; minutes: number; exerciseTypes: string[] }[];
  mistakes: { category: string; note: string; subject: string }[];
  recallScore: number | null;
  recallCount: number;
  tomorrowRecall: string[];
  creatureName?: string;
  stageName: string;
  moodLabel: string;
  playEarned: number;
  playUsed: number;
  lightDay: boolean;
  topMistake?: string;
  note?: string;
}

export function buildReport(r: ReportInput): { subject: string; text: string } {
  const mins = r.blocks.reduce((a, b) => a + b.minutes, 0);
  const subjects = [...new Set(r.blocks.map((b) => b.subject))];
  const lines: string[] = [];
  if (r.mistakes.length) {
    lines.push(`${r.name} caught ${r.mistakes.length} of her own mistake${r.mistakes.length > 1 ? 's' : ''}:`);
    r.mistakes.forEach((m) => lines.push(`  • ${m.category} (${m.subject}): ${m.note}`));
  } else {
    lines.push('No self-caught mistakes logged today.');
  }
  lines.push('');
  lines.push(`Today${r.lightDay ? ' (light day)' : ''}: ${r.blocks.length} block${r.blocks.length === 1 ? '' : 's'}, ${mins} min. ${subjects.join(', ') || 'No blocks yet'}.`);
  r.blocks.forEach((b) => {
    lines.push(`  • ${b.subject}${b.chapter ? `: ${b.chapter}` : ''} (${b.minutes} min)${b.exerciseTypes.length ? `, ${b.exerciseTypes.join(', ')}` : ''}`);
  });
  lines.push('');
  if (r.recallScore !== null) lines.push(`Recall quiz: ${Math.round(r.recallScore * 100)}% across ${r.recallCount} question${r.recallCount === 1 ? '' : 's'}.`);
  if (r.tomorrowRecall.length) lines.push(`Tomorrow's recall: ${r.tomorrowRecall.join('; ')}.`);
  lines.push(`Creature: ${r.creatureName ? `${r.creatureName}, ` : ''}${r.stageName}, ${r.moodLabel}.`);
  lines.push(`Play time: earned ${r.playEarned} min, used ${r.playUsed} min.`);
  if (r.topMistake) lines.push(`Most common slip so far: ${r.topMistake}.`);
  if (r.note?.trim()) {
    lines.push('');
    lines.push(`A note from ${r.name}: ${r.note.trim()}`);
  }
  const subject = `${r.name}'s study day, ${r.dateLabel}: ${r.blocks.length} block${r.blocks.length === 1 ? '' : 's'}, ${r.mistakes.length} mistake${r.mistakes.length === 1 ? '' : 's'} caught`;
  return { subject, text: lines.join('\n') };
}
