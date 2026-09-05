import type { FoundationLessonId } from './foundation.helpers';

/** Per-lesson probe config — setupExact leaves learner on probe step ready to answer. */
export type FoundationPoolGateFixture = {
  lessonId: FoundationLessonId;
  setupExact: string[];
  exactAtProbe: string;
  outOfPoolAtProbe: string;
  wrongAtProbe: string;
  wrongAgainAtProbe: string;
};

export const FOUNDATION_POOLGATE_FIXTURES: FoundationPoolGateFixture[] = [
  {
    lessonId: 'greetings',
    setupExact: ['Hello', 'Hi'],
    exactAtProbe: 'Hi',
    outOfPoolAtProbe: 'Hello',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello there.',
  },
  {
    lessonId: 'introductions',
    setupExact: ['My name is Nana.'],
    exactAtProbe: "I'm Nana.",
    outOfPoolAtProbe: 'My name is Nano.',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello there.',
  },
  {
    lessonId: 'yes_no_maybe',
    setupExact: ['Yes, I do.'],
    exactAtProbe: 'Yes, I do.',
    outOfPoolAtProbe: 'Yes, I do....',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'polite_expressions',
    setupExact: ['Thank you very much.'],
    exactAtProbe: "You're welcome.",
    outOfPoolAtProbe: 'You are welcome.',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'meet_people',
    setupExact: ["I'm new here.", "I'm excited.", "You're my classmate."],
    exactAtProbe: "You're very kind.",
    outOfPoolAtProbe: "You're so kind.",
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'fnd_v2_how_do_you_feel',
    setupExact: ["I'm happy.", "I'm sad.", "I'm tired."],
    exactAtProbe: "I'm hungry.",
    outOfPoolAtProbe: "I'm starving.",
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'talk_about_groups',
    setupExact: ["He's my classmate.", "She's my teacher.", "It's my bag."],
    exactAtProbe: "She's very kind.",
    outOfPoolAtProbe: 'Anna is very kind.',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'fnd_v2_we_they',
    setupExact: ["We're friends.", "We're students.", "They're my friends."],
    exactAtProbe: "They're students.",
    outOfPoolAtProbe: 'Those are students.',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'ee_about_me_family',
    setupExact: [],
    exactAtProbe: 'brother',
    outOfPoolAtProbe: 'my brother',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'numbers',
    setupExact: ['four'],
    exactAtProbe: 'seven',
    outOfPoolAtProbe: 'the number seven',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'fnd_v2_numbers_11_20',
    setupExact: [],
    exactAtProbe: 'fourteen',
    outOfPoolAtProbe: 'the number fourteen',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'fnd_v2_say_it_again',
    setupExact: ['Can you say that again?'],
    exactAtProbe: 'How do you say this in English?',
    outOfPoolAtProbe: 'Could you please say that again',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'fnd_v2_buying_something',
    setupExact: ['I want this.'],
    exactAtProbe: 'I want water.',
    outOfPoolAtProbe: 'I would like some water',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'telling_time',
    setupExact: ["It's six o'clock."],
    exactAtProbe: "It's seven thirty.",
    outOfPoolAtProbe: 'It is 7:30.',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'everyday_numbers',
    setupExact: ['forty'],
    exactAtProbe: 'fifty',
    outOfPoolAtProbe: 'the number fifty',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'money_prices',
    setupExact: ['How much is it?'],
    exactAtProbe: 'How much is it?',
    outOfPoolAtProbe: 'What does it cost?',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'likes_dislikes',
    setupExact: ['I like coffee.'],
    exactAtProbe: 'I like pizza.',
    outOfPoolAtProbe: 'pizza is my favorite food',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'wants_needs',
    setupExact: ['I want water.'],
    exactAtProbe: 'I need help.',
    outOfPoolAtProbe: 'I really need help please',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'can_cant',
    setupExact: ['I can swim.'],
    exactAtProbe: "I can't drive.",
    outOfPoolAtProbe: 'I cannot drive a car',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'asking_for_help',
    setupExact: ["I don't understand."],
    exactAtProbe: 'Can you speak more slowly?',
    outOfPoolAtProbe: 'Could you please speak slower',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
  {
    lessonId: 'asking_questions',
    setupExact: ['Where is the bathroom?'],
    exactAtProbe: 'Who is that?',
    outOfPoolAtProbe: 'Who is that person over there',
    wrongAtProbe: 'Good morning.',
    wrongAgainAtProbe: 'Hello.',
  },
];

export const FOUNDATION_PROBE_LEARNER = 'Nana';
