import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DRAW_WORDS, WHO_CHARACTERS } from './live-talk-games.content';
import {
  changeWord,
  confirmCorrect,
  createGame,
  GameRuleError,
  hintIndexesAt,
  matchesAnswer,
  normalizeTurnSeconds,
  publicView,
  secretFor,
  submitGuess,
  syncSpeakers,
  tick,
  type GamePerson,
  type LiveTalkGameType,
} from './live-talk-games.rules';

const people = (...names: string[]): GamePerson[] =>
  names.map((n) => ({ userId: n.toLowerCase(), name: n }));
const rng = () => 0; // deterministic: no shuffle, first word
const T0 = 1_000_000;

function game(type: LiveTalkGameType, names = ['Host', 'Bee', 'Ploy']) {
  return createGame({
    id: 'g1',
    roomId: 'r1',
    type,
    level: 'A1',
    hostUserId: 'host',
    speakers: people(...names),
    now: T0,
    rng,
  });
}

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof GameRuleError) return e.code;
    throw e;
  }
  return 'ok';
}

describe('live talk games: setup', () => {
  it('needs 2+ speakers; draw = 2 turns each, who = 1 each', () => {
    assert.equal(code(() => game('draw', ['Host'])), 'not_enough_players');
    assert.equal(game('draw').totalTurns, 6);
    assert.equal(game('who').totalTurns, 3);
  });

  it('turn length: allowed values only, defaults 45 / 90', () => {
    assert.equal(normalizeTurnSeconds('draw', 30), 30);
    assert.equal(normalizeTurnSeconds('draw', 90), 45);
    assert.equal(normalizeTurnSeconds('who', 120), 120);
    assert.equal(normalizeTurnSeconds('who', undefined), 90);
  });

  it('content: unique answers, Thai on every item, A1 subset exists', () => {
    for (const list of [DRAW_WORDS, WHO_CHARACTERS]) {
      assert.equal(new Set(list.map((x) => x.en)).size, list.length);
      for (const item of list) assert.ok(item.th.trim(), item.en);
      assert.ok(list.filter((x) => x.level === 'A1').length >= 30);
    }
  });
});

describe('Draw & Guess', () => {
  it('only the drawer sees the word; public state hides it until the reveal', () => {
    const g = game('draw');
    const drawer = g.turn!.userId;
    const other = g.players.find((p) => p.userId !== drawer)!.userId;
    assert.ok(secretFor(g, drawer));
    assert.equal(secretFor(g, other), null);
    const view = publicView(g, T0);
    assert.equal(view.turn!.answer, null);
    assert.ok(view.turn!.hint!.pattern.every((ch) => ch === '_' || ch === ' '));
    assert.ok(!JSON.stringify(view).includes(`"${g.turn!.secret.en}"`));
  });

  it('every right guesser +10, drawer +5 each; turn ends when all guessed', () => {
    const g = game('draw');
    const drawer = g.turn!.userId;
    const [a, b] = g.players.filter((p) => p.userId !== drawer).map((p) => p.userId);
    const word = g.turn!.secret.en;
    assert.equal(submitGuess(g, a, `I think it's a ${word}`, T0 + 5_000).correct, true);
    assert.equal(g.phase, 'turn');
    assert.equal(submitGuess(g, b, word, T0 + 6_000).correct, true);
    assert.equal(g.phase, 'reveal');
    const score = (id: string) => g.players.find((p) => p.userId === id)!.score;
    assert.deepEqual([score(a), score(b), score(drawer)], [10, 10, 10]);
    assert.equal(publicView(g, T0 + 6_000).turn!.answer!.en, word);
    assert.equal(publicView(g, T0 + 6_000).nextUserId, g.queue[0]);
  });

  it('wrong guesses go to the feed; 2 s cooldown; drawer and repeat guessers refused', () => {
    const g = game('draw');
    const drawer = g.turn!.userId;
    const a = g.players.find((p) => p.userId !== drawer)!.userId;
    assert.equal(submitGuess(g, a, 'zebra', T0 + 1_000).correct, false);
    assert.equal(g.feed.at(-1)!.text, 'zebra');
    assert.equal(code(() => submitGuess(g, a, 'zebra', T0 + 2_000)), 'cooldown');
    assert.equal(code(() => submitGuess(g, drawer, 'x', T0 + 9_000)), 'drawer_cannot_guess');
    submitGuess(g, a, g.turn!.secret.en, T0 + 4_000);
    assert.equal(code(() => submitGuess(g, a, 'again', T0 + 9_000)), 'already_guessed');
  });

  it('change word: drawer only, once, first 10 s; old word not dealt again', () => {
    const g = game('draw');
    const drawer = g.turn!.userId;
    const first = g.turn!.secret.en;
    assert.equal(code(() => changeWord(g, 'bee' === drawer ? 'ploy' : 'bee', T0, rng)), 'not_drawer');
    changeWord(g, drawer, T0 + 9_000, rng);
    assert.notEqual(g.turn!.secret.en, first);
    assert.equal(code(() => changeWord(g, drawer, T0 + 9_500, rng)), 'already_changed');
    const g2 = game('draw');
    assert.equal(code(() => changeWord(g2, g2.turn!.userId, T0 + 10_001, rng)), 'change_window_closed');
  });

  it('timer: hints at 40% / 65%, time up → reveal 3 s → next turn', () => {
    const g = game('draw');
    const len = g.turn!.endsAt - T0;
    const word = g.turn!.secret.en;
    tick(g, T0 + len * 0.41, rng);
    assert.deepEqual(g.turn!.revealed, hintIndexesAt(word, 0.41));
    tick(g, T0 + len * 0.66, rng);
    assert.deepEqual(g.turn!.revealed, hintIndexesAt(word, 0.66));
    assert.ok(publicView(g, T0 + len * 0.66).turn!.hint!.pattern.includes(word[0]));
    tick(g, T0 + len, rng);
    assert.equal(g.phase, 'reveal');
    assert.equal(g.turn!.result, 'timeup');
    tick(g, T0 + len + 3_000, rng);
    assert.equal(g.phase, 'turn');
    assert.equal(g.turnNumber, 2);
  });

  it('hint letters', () => {
    assert.deepEqual(hintIndexesAt('elephant', 0.3), []);
    assert.deepEqual(hintIndexesAt('elephant', 0.4), [0]);
    assert.deepEqual(hintIndexesAt('elephant', 0.7), [0, 4]);
    assert.deepEqual(hintIndexesAt('cat', 0.9), [0]);
  });
});

describe('Who Am I?', () => {
  it('everyone but the asker sees the card; Correct! gives the asker +10', () => {
    const g = game('who');
    const asker = g.turn!.userId;
    const other = g.players.find((p) => p.userId !== asker)!.userId;
    assert.equal(secretFor(g, asker), null);
    assert.ok(secretFor(g, other));
    assert.ok(secretFor(g, 'some-listener'));
    assert.equal(code(() => confirmCorrect(g, asker, T0 + 1)), 'asker_cannot_confirm');
    confirmCorrect(g, other, T0 + 20_000);
    assert.equal(g.phase, 'reveal');
    assert.equal(g.turn!.result, 'correct');
    assert.equal(g.players.find((p) => p.userId === asker)!.score, 10);
  });

  it('game over after the last turn, then ended after 8 s', () => {
    const g = game('who', ['Host', 'Bee']);
    let now = T0;
    for (let i = 0; i < 2; i++) {
      now = g.turn!.endsAt;
      tick(g, now, rng); // time up
      now += 3_000;
      tick(g, now, rng); // next turn or over
    }
    assert.equal(g.phase, 'over');
    assert.equal(publicView(g, now).words.length, 2);
    assert.equal(tick(g, now + 7_000, rng), 'idle');
    assert.equal(tick(g, now + 8_000, rng), 'ended');
  });
});

describe('players on and off stage', () => {
  it('leaving skips your turn; coming back restores your score', () => {
    const g = game('draw', ['Host', 'Bee', 'Ploy', 'Ton']);
    const drawer = g.turn!.userId;
    const guesser = g.players.find((p) => p.userId !== drawer && p.userId !== 'host')!;
    submitGuess(g, guesser.userId, g.turn!.secret.en, T0 + 1_000);
    const all = g.players.map((p) => ({ userId: p.userId, name: p.name }));
    syncSpeakers(g, all.filter((p) => p.userId !== guesser.userId), T0 + 2_000);
    assert.equal(guesser.active, false);
    if (drawer !== 'host') {
      syncSpeakers(g, all.filter((p) => p.userId !== drawer), T0 + 3_000);
      assert.equal(g.turn!.result, 'skipped');
    }
    syncSpeakers(g, all, T0 + 4_000);
    assert.equal(guesser.active, true);
    assert.equal(guesser.score, 10);
  });

  it('host leaving or fewer than 2 players ends the game', () => {
    const g = game('who');
    syncSpeakers(g, people('Bee', 'Ploy'), T0 + 1);
    assert.equal(g.phase, 'over');
    const g2 = game('who');
    syncSpeakers(g2, people('Host'), T0 + 1);
    assert.equal(g2.phase, 'over');
  });

  it('speakers who join mid-game only watch', () => {
    const g = game('who');
    syncSpeakers(g, people('Host', 'Bee', 'Ploy', 'Newbie'), T0 + 1);
    assert.equal(g.players.some((p) => p.userId === 'newbie'), false);
  });
});

describe('answer matching', () => {
  const s = (en: string, also?: string[]) => ({ en, also });
  it('accepts sentences, plurals, synonyms and one typo on long words', () => {
    assert.ok(matchesAnswer("I think it's an elephant.", s('elephant')));
    assert.ok(matchesAnswer('cats', s('cat')));
    assert.ok(matchesAnswer('Is it ice cream?', s('ice cream')));
    assert.ok(matchesAnswer('icecream', s('ice cream', ['icecream'])));
    assert.ok(matchesAnswer('a bike', s('bicycle', ['bike'])));
    assert.ok(matchesAnswer('elephent', s('elephant')));
  });
  it('rejects near misses on short words and look-alikes', () => {
    assert.equal(matchesAnswer('cut', s('cat')), false);
    assert.equal(matchesAnswer('category', s('cat')), false);
    assert.equal(matchesAnswer('elevator', s('elephant')), false);
    assert.equal(matchesAnswer('', s('cat')), false);
  });
});
