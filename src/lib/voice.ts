import type { Mood } from '../types';

// The creature's voice: warm, playful, a little mysterious. Never scolding, never babyish.
const pick = <T,>(list: T[], seed = Date.now()) => list[Math.floor(seed / 60000) % list.length];

export const lines = {
  greet: (name: string, mood: Mood) => {
    if (mood === 'paused') return 'Zzz… resting peacefully until we start again. No rush at all.';
    if (mood === 'sleepy') return pick([
      `*yawns* Oh, ${name}! I've been dozing. A study block would wake me right up.`,
      `${name}! I was napping in a sunbeam. Shall we do something clever together?`,
    ]);
    return pick([
      `${name}! I saved you a spot. What are we exploring today?`,
      `There you are, ${name}! My whiskers were twitching. I knew you'd come.`,
      `Hello, ${name}. I found a strange glowing pebble today. Want to earn some adventure?`,
      `${name}! Ready to be brilliant and careful? That's my favourite combination.`,
    ]);
  },
  eggGreet: (name: string) => pick([
    `The egg wobbles when you come close, ${name}. I think it likes you.`,
    `Something inside the egg is humming. Two finished study blocks might wake it…`,
  ]),
  overPlanned: 'Ooh, that\'s a lot for one day! Three blocks is plenty. Want to move one?',
  avoidance: (subject: string) => `${subject} keeps slipping away from us. How about a short, easy 15-minute block of it? Tiny steps count.`,
  briefing: 'Detective time! Sixty seconds of looking closely saves a whole lot of marks.',
  blockStart: pick(['Off we go! I\'ll keep quiet and keep watch.', 'Timer\'s running. You focus, I\'ll guard the snacks.']),
  blockEnd: 'Bong! Block done. Now tell me what you discovered. I collect facts like shiny stones.',
  takeawayGood: pick(['Ooh, a shiny one!', 'Specific! I love it.', 'That one\'s going in my treasure box.', 'Sharp!']),
  mistakeCaught: (cat: string) => pick([
    `You caught a "${cat}" before it caught you. Sharp eyes!`,
    `A "${cat}", spotted and fixed. That's real detective work!`,
  ]),
  breakTime: 'Stretch, sip some water, look out of a window. I\'ll call you back.',
  wrapUp: (name: string) => `What a session, ${name}! Let's see what you've earned.`,
  timeUp: "That's enough adventure for today! Let's save some magic for tomorrow.",
  reportReminder: 'Mum hasn\'t heard about today yet. Want to tell her how it went?',
  reportReminderPast: 'Mum hasn\'t heard about our last study day yet. Shall we send it now?',
  reportSent: 'Sent! I added a little sparkle to it.',
  lightDay: 'A light day! One cosy block and three good points. It still counts, I promise.',
};
