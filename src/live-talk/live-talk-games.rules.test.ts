import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DRAW_WORDS, WHO_CHARACTERS } from './live-talk-games.content';
import {
  acceptPendingWord,
  CHAIN_GRACE_MS,
  CHAIN_OVERRIDE_MS,
  CHAIN_RESUME_MIN_MS,
  CHAIN_REVEAL_MS,
  CHAIN_ROUND_REVEAL_MS,
  chainSecondsFor,
  changeWord,
  confirmCorrect,
  createGame,
  GameRuleError,
  hintIndexesAt,
  matchesAnswer,
  normalizeTurnSeconds,
  publicView,
  secretFor,
  submitChainCaption,
  submitGuess,
  submitWhoCaption,
  syncSpeakers,
  tick,
  vocabForTurn,
  type GamePerson,
  type LiveTalkGameType,
  whoPointsAt,
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
  it('needs 2+ speakers; draw = 2 turns each, who = 2 each up to 3 players, else 1', () => {
    assert.equal(code(() => game('draw', ['Host'])), 'not_enough_players');
    assert.equal(game('draw').totalTurns, 6);
    assert.equal(game('who').totalTurns, 6);
    assert.equal(game('who', ['Host', 'Bee', 'Ploy', 'Ton']).totalTurns, 4);
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

describe('live talk games: A1 / A2 check marks', () => {
  const pick = (levels?: ('A1' | 'A2')[], level: 'A1' | 'A2' = 'A1') => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      let x = i;
      const g = createGame({
        id: 'g', roomId: 'r', type: 'draw', level, levels, hostUserId: 'host',
        speakers: people('Host', 'Bee'), now: T0,
        rng: () => ((x = (x * 9301 + 49297) % 233280) / 233280),
      });
      const drawer = g.turn!.userId;
      seen.add(secretFor(g, drawer)!.en);
    }
    return [...seen].map((en) => DRAW_WORDS.find((w) => w.en === en)!.level);
  };
  it('A2 only gives A2 words; A1 only gives A1 words', () => {
    assert.ok(pick(['A2']).every((l) => l === 'A2'));
    assert.ok(pick(['A1']).every((l) => l === 'A1'));
  });
  it('old `level` still works: A2 = A1 + A2', () => {
    const g = createGame({ id: 'g', roomId: 'r', type: 'draw', level: 'A2', hostUserId: 'host', speakers: people('Host', 'Bee'), now: T0, rng });
    assert.deepEqual(g.levels, ['A1', 'A2']);
    assert.equal(publicView(g, T0).level, 'A2');
  });
});

describe('Draw & Guess', () => {
  it('typed guess: right word wins, a list of words does not', () => {
    const g = game('draw');
    const drawer = g.turn!.userId;
    const [a, b] = g.players.map((p) => p.userId).filter((id) => id !== drawer);
    const word = secretFor(g, drawer)!.en;
    assert.equal(submitGuess(g, a, `cat dog bird ${word}`, T0 + 1000, { typed: true }).correct, false);
    assert.equal(submitGuess(g, b, word, T0 + 1000, { typed: true }).correct, true);
  });

  it('only the drawer sees the word; public state hides it until the reveal', () => {
    const g = game('draw');
    const drawer = g.turn!.userId;
    const other = g.players.find((p) => p.userId !== drawer)!.userId;
    assert.ok(secretFor(g, drawer));
    assert.equal(secretFor(g, other), null);
    const view = publicView(g, T0);
    assert.equal(view.turn!.answer, null);
    assert.ok(view.turn!.hint!.pattern.every((ch) => ch === '_' || ch === ' '));
    // The answer only appears inside the STT vocab list, among the whole category.
    const { vocab, ...rest } = view.turn!.hint!;
    assert.ok(!JSON.stringify({ ...view, turn: { ...view.turn, hint: rest } }).includes(`"${g.turn!.secret.en}"`));
    assert.ok(vocab.includes(g.turn!.secret.en));
    assert.ok(vocab.length > 3);
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
  it('everyone but the asker sees the card; Correct! in the first third gives +15', () => {
    const g = game('who');
    const asker = g.turn!.userId;
    const other = g.players.find((p) => p.userId !== asker)!.userId;
    assert.equal(secretFor(g, asker), null);
    assert.ok(secretFor(g, other));
    assert.ok(secretFor(g, 'some-listener'));
    assert.equal(code(() => confirmCorrect(g, asker, T0 + 1)), 'asker_cannot_confirm');
    // The host confirms; when the host asks, another player does.
    const confirmer = asker === 'host' ? other : 'host';
    const notHost = g.players.find((p) => p.userId !== asker && p.userId !== 'host')!.userId;
    if (asker !== 'host') assert.equal(code(() => confirmCorrect(g, notHost, T0 + 20_000)), 'host_only');
    assert.equal(code(() => confirmCorrect(g, confirmer, T0 + 2_000)), 'too_early');
    confirmCorrect(g, confirmer, T0 + 20_000);
    assert.equal(g.phase, 'reveal');
    assert.equal(g.turn!.result, 'correct');
    assert.equal(g.players.find((p) => p.userId === asker)!.score, 15);
    const view = publicView(g, T0 + 20_000);
    assert.equal(view.turn!.points, 15);
    assert.equal(view.turn!.solvedMs, 20_000);
  });

  it('points by time: thirds of the turn → 15 / 10 / 5', () => {
    const turn = { startedAt: 0, endsAt: 90_000 };
    assert.equal(whoPointsAt(turn, 0), 15);
    assert.equal(whoPointsAt(turn, 29_999), 15);
    assert.equal(whoPointsAt(turn, 30_000), 10);
    assert.equal(whoPointsAt(turn, 59_999), 10);
    assert.equal(whoPointsAt(turn, 60_000), 5);
    assert.equal(whoPointsAt(turn, 95_000), 5);
    assert.equal(whoPointsAt({ startedAt: 0, endsAt: 60_000 }, 25_000), 10);
  });

  it('the asker saying the answer late gets fewer points', () => {
    const g = game('who');
    const asker = g.turn!.userId;
    submitWhoCaption(g, asker, `Am I a ${g.turn!.secret.en}?`, T0 + 70_000);
    assert.equal(g.turn!.result, 'correct');
    assert.equal(g.players.find((p) => p.userId === asker)!.score, 5);
  });

  it("the asker saying the card's word in their captions ends the turn", () => {
    const g = game('who');
    const asker = g.turn!.userId;
    const other = g.players.find((p) => p.userId !== asker)!.userId;
    const word = g.turn!.secret.en;
    assert.equal(code(() => submitWhoCaption(g, other, word, T0 + 9_000)), 'not_asker');
    assert.equal(submitWhoCaption(g, asker, 'Do I live on a farm?', T0 + 9_000).correct, false);
    assert.equal(g.phase, 'turn');
    assert.equal(submitWhoCaption(g, asker, `Am I a ${word}?`, T0 + 12_000).correct, true);
    assert.equal(g.phase, 'reveal');
    assert.equal(g.players.find((p) => p.userId === asker)!.score, 15);
  });

  it('game over after the last turn, then ended after 8 s', () => {
    const g = game('who', ['Host', 'Bee']);
    let now = T0;
    for (let i = 0; i < 4; i++) {
      now = g.turn!.endsAt;
      tick(g, now, rng); // time up
      now += 3_000;
      tick(g, now, rng); // next turn or over
    }
    assert.equal(g.phase, 'over');
    assert.equal(publicView(g, now).words.length, 4);
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

describe('Game Mic STT vocab', () => {
  it('always has the answer, max 24 words, alphabetical', () => {
    for (const w of DRAW_WORDS) {
      for (const seed of [1, 99, 123456]) {
        const v = vocabForTurn('A2', w, seed);
        assert.ok(v.includes(w.en), w.en);
        assert.ok(v.length <= 24);
        assert.deepEqual(v, [...v].sort((a, b) => a.localeCompare(b)));
      }
    }
  });
});

describe('word chain', () => {
  const chainGame = (names = ['Host', 'Bee', 'Ploy'], turnSeconds?: number) =>
    createGame({
      id: 'c1',
      roomId: 'r1',
      type: 'chain',
      level: 'A1',
      turnSeconds,
      hostUserId: 'host',
      speakers: people(...names),
      now: T0,
      rng,
    });
  const say = (g: ReturnType<typeof chainGame>, text: string, now: number) =>
    submitChainCaption(g, g.turn!.userId, text, now, rng);
  /** Finish the reveal and start the next turn. */
  const next = (g: ReturnType<typeof chainGame>) => {
    const at = g.phaseEndsAt!;
    tick(g, at, rng);
    return at;
  };

  it('setup: 15 s (or 12 hard), 2 hearts each, open-ended turns, no secret', () => {
    const g = chainGame();
    assert.equal(g.turnSeconds, 15);
    assert.equal(chainGame(undefined, 12).turnSeconds, 12);
    assert.equal(normalizeTurnSeconds('chain', 30), 15);
    assert.equal(g.totalTurns, 0);
    assert.deepEqual(Object.values(g.chain!.hearts), [2, 2, 2]);
    assert.equal(g.chain!.letter, 'a');
    assert.equal(g.turn!.endsAt, T0 + 15_000);
    assert.equal(secretFor(g, 'bee'), null);
    assert.equal(publicView(g, T0).chain?.letter, 'a');
  });

  it('time drops 2 s a round down to 5 s', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((r) => chainSecondsFor(15, r)), [15, 13, 11, 9, 7, 5, 5]);
    assert.deepEqual([1, 2, 3, 4, 5].map((r) => chainSecondsFor(12, r)), [12, 10, 8, 6, 5]);
  });

  it('counts the last listed word with the letter; next letter = last letter', () => {
    const g = chainGame();
    const first = g.turn!.userId;
    assert.equal(say(g, 'umm I think apple', T0 + 3000).correct, true);
    assert.equal(g.phase, 'reveal');
    assert.equal(g.turn!.word, 'apple');
    assert.equal(g.players.find((p) => p.userId === first)!.score, 10);
    assert.equal(g.chain!.letter, 'e');
    assert.equal(g.phaseEndsAt, T0 + 3000 + CHAIN_REVEAL_MS);
    next(g);
    assert.notEqual(g.turn!.userId, first);
    assert.equal(g.turn!.secret.en, 'e');
  });

  it('x / q / z / y endings get a fresh letter', () => {
    const g = chainGame();
    say(g, 'angry', T0 + 1000);
    assert.equal(g.chain!.rerolledFrom, 'y');
    assert.equal(g.chain!.letter, 'a');
  });

  it('used words and wrong letters only show in the feed; the clock keeps going', () => {
    const g = chainGame();
    say(g, 'apple', T0 + 1000);
    next(g);
    g.chain!.letter = 'a';
    const ends = g.turn!.endsAt;
    assert.equal(say(g, 'apple', T0 + 4000).correct, false);
    assert.equal(g.feed[g.feed.length - 1]?.note, 'used');
    assert.equal(say(g, 'banana', T0 + 4500).correct, false);
    assert.equal(g.feed[g.feed.length - 1]?.note, 'letter');
    assert.equal(g.turn!.pending, null);
    assert.equal(g.turn!.endsAt, ends);
  });

  it('unknown word: clock stops, the host may count it', () => {
    const g = chainGame();
    const player = g.turn!.userId;
    assert.equal(say(g, 'avocadoes', T0 + 2000).correct, false);
    assert.deepEqual(g.turn!.pending, { word: 'avocadoes', until: T0 + 2000 + CHAIN_OVERRIDE_MS });
    assert.equal(g.turn!.pausedLeftMs, 13_000);
    assert.equal(publicView(g, T0 + 2000).turn?.pending?.word, 'avocadoes');
    assert.equal(code(() => acceptPendingWord(g, player, T0 + 2500, rng)), 'player_cannot_confirm');
    const other = g.players.find((p) => p.userId !== player && p.userId !== 'host')!.userId;
    assert.equal(code(() => acceptPendingWord(g, other, T0 + 2500, rng)), 'host_only');
    acceptPendingWord(g, 'host', T0 + 2500, rng);
    assert.equal(g.turn!.word, 'avocadoes');
    assert.equal(g.chain!.letter, 's');
  });

  it('no "นับให้" in time: the clock runs again (at least 2 s)', () => {
    const g = chainGame();
    say(g, 'avocadoes', T0 + 14_500);
    const at = T0 + 14_500 + CHAIN_OVERRIDE_MS;
    assert.equal(tick(g, at, rng), 'changed');
    assert.equal(g.turn!.pending, null);
    assert.equal(g.turn!.endsAt, at + CHAIN_RESUME_MIN_MS);
    assert.equal(code(() => acceptPendingWord(g, 'host', at + 10, rng)), 'nothing_pending');
  });

  it('a caption a little after 0 still counts; then time up costs a heart', () => {
    const g = chainGame();
    assert.equal(tick(g, T0 + 15_000 + 500, rng), 'idle');
    assert.equal(say(g, 'ant', T0 + 15_000 + 1000).correct, true);
    next(g);
    const p = g.turn!.userId;
    const end = g.turn!.endsAt;
    assert.equal(tick(g, end + CHAIN_GRACE_MS, rng), 'changed');
    assert.equal(g.turn!.result, 'timeup');
    assert.equal(g.chain!.hearts[p], 1);
    assert.equal(g.chain!.out.length, 0);
  });

  it('out after 2 misses; the last one standing gets +20 and the game ends', () => {
    const g = chainGame(['Host', 'Bee']);
    const miss = () => {
      tick(g, g.turn!.endsAt + CHAIN_GRACE_MS, rng);
      return next(g);
    };
    const firstPlayer = g.turn!.userId;
    miss(); // first player: 1 heart
    say(g, 'apple', g.turn!.startedAt + 1000); // second player scores
    next(g); // new round
    assert.equal(g.chain!.round, 2);
    assert.equal(g.turnSeconds, 13);
    tick(g, g.turn!.endsAt + CHAIN_GRACE_MS, rng); // first player out
    assert.deepEqual(g.chain!.out, [firstPlayer]);
    next(g);
    assert.equal(g.phase, 'over');
    const winner = g.players.find((p) => p.userId !== firstPlayer)!;
    assert.equal(winner.score, 10 + 20);
  });

  it('a new round gets a longer reveal with the new time', () => {
    const g = chainGame(['Host', 'Bee']);
    say(g, 'apple', T0 + 1000);
    next(g);
    say(g, 'egg', g.turn!.startedAt + 1000);
    assert.equal(g.phaseEndsAt! - g.turn!.startedAt - 1000, CHAIN_ROUND_REVEAL_MS);
    assert.equal(publicView(g, g.phaseEndsAt! - 1).chain?.nextSeconds, 13);
  });

  it('only the player whose turn it is can answer', () => {
    const g = chainGame();
    const other = g.players.find((p) => p.userId !== g.turn!.userId)!.userId;
    assert.equal(code(() => submitChainCaption(g, other, 'apple', T0 + 1000, rng)), 'not_your_turn');
  });
});
