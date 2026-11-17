import {
  contentForLevels,
  levelsFromLegacy,
  DRAW_WORDS,
  WHO_CHARACTERS,
  type LiveTalkGameLevel,
} from './live-talk-games.content';
import { CHAIN_WORDS } from './live-talk-chain.words';

/**
 * Live Talk mini games (Draw & Guess, Who Am I?). Pure state machine: the
 * service owns timers and broadcasting; everything here takes `now` (ms) and
 * an `rng` so it is deterministic in tests.
 *
 * Rules (spec agreed 2026-11):
 * - Players = speakers on stage when the game starts. Leaving drops you from
 *   the rotation; coming back to the stage in the same game restores your
 *   score. New speakers watch until the next game.
 * - Draw & Guess: everyone draws twice; 30/45/60 s per turn (default 45).
 *   Guess any time with the Game Mic; every right guesser +10, the drawer +5
 *   per right guesser. Turn ends when all guessed or time is up. The drawer
 *   may change the word once in the first 10 s. Letter hints at 40% / 65%.
 * - Who Am I?: one turn each; the asker keeps asking until the host taps
 *   Correct! (another player when the host asks) or time is up (60/90/120 s, default 90). Right = +10.
 * - Reveal 3 s between turns; game over popup 8 s. Fewer than 2 players or
 *   the host gone → game over.
 * - Word Chain: say a word that starts with the last letter of the previous
 *   word (spoken; the captions agent follows the player). The system counts
 *   words from CHAIN_WORDS; an unknown word pauses the clock 3 s so the host
 *   can tap "นับให้". Time up = −1 heart (2 each), 0 hearts = out. Time per
 *   turn drops 2 s every round (15 → 5 normal, 12 → 5 hard). +10 a word,
 *   the last one standing +20.
 */
export type LiveTalkGameType = 'draw' | 'who' | 'chain';
export type LiveTalkGamePhase = 'turn' | 'reveal' | 'over';
export type TurnResult = 'correct' | 'timeup' | 'skipped';

export const GAME_MIN_PLAYERS = 2;
export const DRAW_TURN_SECONDS = [30, 45, 60] as const;
export const WHO_TURN_SECONDS = [60, 90, 120] as const;
export const DRAW_DEFAULT_SECONDS = 45;
export const WHO_DEFAULT_SECONDS = 90;
export const DRAW_ROUNDS_EACH = 2;
export const WHO_ROUNDS_EACH = 1;
/** Who Am I?: small games (≤ this many players) get 2 turns each. */
export const WHO_SMALL_GAME_PLAYERS = 3;

export function whoRoundsFor(players: number): number {
  return players <= WHO_SMALL_GAME_PLAYERS ? 2 : WHO_ROUNDS_EACH;
}
export const CHANGE_WORD_WINDOW_MS = 10_000;
export const GUESS_COOLDOWN_MS = 2_000;
export const REVEAL_MS = 3_000;
export const GAME_OVER_MS = 8_000;
export const HINT_AT = [0.4, 0.65] as const;
export const POINTS_RIGHT_GUESS = 10;
export const POINTS_DRAWER_PER_GUESS = 5;
/**
 * Who Am I?: faster = more. The turn is split in thirds (30 s each at 90 s):
 * right in the first third +15, second +10, last +5.
 */
export const WHO_POINT_TIERS = [15, 10, 5] as const;

/** Points the asker would get for a right answer at [now]. */
export function whoPointsAt(turn: Pick<GameTurn, 'startedAt' | 'endsAt'>, now: number): number {
  const total = Math.max(1, turn.endsAt - turn.startedAt);
  const fraction = Math.max(0, now - turn.startedAt) / total;
  const tier = Math.min(WHO_POINT_TIERS.length - 1, Math.floor(fraction * WHO_POINT_TIERS.length));
  return WHO_POINT_TIERS[tier];
}
/** Who Am I?: Correct! is locked for the first seconds of a turn. */
export const WHO_CONFIRM_LOCK_MS = 5_000;

// Word Chain
/** Start seconds: normal 15, hard 12 (the host's choice). */
export const CHAIN_START_SECONDS = [15, 12] as const;
export const CHAIN_DEFAULT_SECONDS = 15;
export const CHAIN_MIN_SECONDS = 5;
export const CHAIN_STEP_SECONDS = 2;
export const CHAIN_HEARTS = 2;
export const CHAIN_MAX_ROUNDS = 12;
/** Captions land ~1 s after the player stops talking: accept them a bit late. */
export const CHAIN_GRACE_MS = 1_500;
/** Unknown word: the clock stops this long for the host's "นับให้". */
export const CHAIN_OVERRIDE_MS = 3_000;
/** After an unknown word, the player gets at least this long to try again. */
export const CHAIN_RESUME_MIN_MS = 2_000;
export const CHAIN_REVEAL_MS = 2_000;
/** Longer pause when a new (faster) round starts, for the banner. */
export const CHAIN_ROUND_REVEAL_MS = 3_000;
export const CHAIN_POINTS_WORD = 10;
export const CHAIN_SURVIVOR_BONUS = 20;
/** Hard last letters get a fresh easy one. */
export const CHAIN_REROLL_FROM = ['x', 'q', 'z', 'y'] as const;
export const CHAIN_START_LETTERS = [...'abcdfghlmnprstw'];

export function chainSecondsFor(startSeconds: number, round: number): number {
  return Math.max(CHAIN_MIN_SECONDS, startSeconds - CHAIN_STEP_SECONDS * (Math.max(1, round) - 1));
}
const FEED_SIZE = 4;

export type GamePerson = { userId: string; name: string; avatarId?: string | null };

export type GamePlayer = GamePerson & {
  score: number;
  /** On stage right now. Off-stage players keep their score for a rejoin. */
  active: boolean;
};

export type GameSecret = { en: string; th: string; category?: string; also?: string[] };

export type GameTurn = {
  userId: string;
  startedAt: number;
  endsAt: number;
  secret: GameSecret;
  changedWord: boolean;
  /** Draw: user ids that guessed right, in order. */
  guessed: string[];
  /** Draw: letter indexes revealed as hints. */
  revealed: number[];
  result?: TurnResult;
  /** Who Am I? / Word Chain: points the player got and how long it took (ms). */
  points?: number;
  solvedMs?: number;
  /** Word Chain: the word that counted. */
  word?: string;
  /** Word Chain: unknown word waiting for the host's "นับให้" (clock stopped). */
  pending?: { word: string; until: number } | null;
  /** Word Chain: turn time left when the clock stopped. */
  pausedLeftMs?: number;
};

/** Word Chain notes: `used` already said, `letter` nothing with the letter, `unknown` not in the list. */
export type GameFeedItem = {
  userId: string;
  text: string;
  correct: boolean;
  note?: 'used' | 'letter' | 'unknown';
};

export type ChainState = {
  startSeconds: number;
  round: number;
  /** Seat order (shuffled once); each round goes through it again. */
  order: string[];
  letter: string;
  prevWord: string | null;
  prevUserId: string | null;
  /** The hard letter that was swapped for `letter` (x/q/z/y), else null. */
  rerolledFrom: string | null;
  hearts: Record<string, number>;
  /** Out of hearts, in order. */
  out: string[];
  words: { userId: string; en: string }[];
};

export type LiveTalkGame = {
  id: string;
  roomId: string;
  type: LiveTalkGameType;
  /** Highest ticked level (old clients read this). */
  level: LiveTalkGameLevel;
  /** Word sets the host ticked (A1 and/or A2). */
  levels: LiveTalkGameLevel[];
  turnSeconds: number;
  hostUserId: string;
  players: GamePlayer[];
  /** Remaining turn order (user ids). */
  queue: string[];
  totalTurns: number;
  turnNumber: number;
  phase: LiveTalkGamePhase;
  phaseEndsAt?: number;
  turn: GameTurn | null;
  used: string[];
  /** Answers of finished turns (game-over word list). */
  answers: GameSecret[];
  feed: GameFeedItem[];
  lastGuessAt: Record<string, number>;
  /** Bumped on every change so clients drop stale packets. */
  seq: number;
  /** Word Chain only. */
  chain?: ChainState;
};

export type Rng = () => number;

export class GameRuleError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export function isGameType(value: unknown): value is LiveTalkGameType {
  return value === 'draw' || value === 'who' || value === 'chain';
}

export function normalizeTurnSeconds(type: LiveTalkGameType, seconds: unknown): number {
  if (type === 'chain') {
    const n = Number(seconds);
    return (CHAIN_START_SECONDS as readonly number[]).includes(n) ? n : CHAIN_DEFAULT_SECONDS;
  }
  const allowed: readonly number[] = type === 'draw' ? DRAW_TURN_SECONDS : WHO_TURN_SECONDS;
  const n = Number(seconds);
  if (allowed.includes(n)) return n;
  return type === 'draw' ? DRAW_DEFAULT_SECONDS : WHO_DEFAULT_SECONDS;
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createGame(input: {
  id: string;
  roomId: string;
  type: LiveTalkGameType;
  level: LiveTalkGameLevel;
  /** Check marks from the host; wins over `level` when given. */
  levels?: LiveTalkGameLevel[];
  turnSeconds?: number;
  hostUserId: string;
  speakers: GamePerson[];
  now: number;
  rng: Rng;
}): LiveTalkGame {
  const people = dedupe(input.speakers);
  if (people.length < GAME_MIN_PLAYERS) throw new GameRuleError('not_enough_players');
  const rounds =
    input.type === 'draw' ? DRAW_ROUNDS_EACH : input.type === 'chain' ? 1 : whoRoundsFor(people.length);
  const order = shuffle(people.map((p) => p.userId), input.rng);
  const queue: string[] = [];
  for (let r = 0; r < rounds; r++) queue.push(...order);
  const game: LiveTalkGame = {
    id: input.id,
    roomId: input.roomId,
    type: input.type,
    level: input.levels?.length ? (input.levels.includes('A2') ? 'A2' : 'A1') : input.level,
    levels: input.levels?.length ? [...new Set(input.levels)] : levelsFromLegacy(input.level),
    turnSeconds: normalizeTurnSeconds(input.type, input.turnSeconds),
    hostUserId: input.hostUserId,
    players: people.map((p) => ({ ...p, score: 0, active: true })),
    queue,
    totalTurns: queue.length,
    turnNumber: 0,
    phase: 'turn',
    turn: null,
    used: [],
    answers: [],
    feed: [],
    lastGuessAt: {},
    seq: 0,
  };
  if (input.type === 'chain') {
    game.totalTurns = 0;
    game.chain = {
      startSeconds: game.turnSeconds,
      round: 1,
      order,
      letter: CHAIN_START_LETTERS[Math.floor(input.rng() * CHAIN_START_LETTERS.length)] ?? 's',
      prevWord: null,
      prevUserId: null,
      rerolledFrom: null,
      hearts: Object.fromEntries(people.map((p) => [p.userId, CHAIN_HEARTS])),
      out: [],
      words: [],
    };
  }
  startNextTurn(game, input.now, input.rng);
  return game;
}

function dedupe(people: GamePerson[]): GamePerson[] {
  const seen = new Set<string>();
  return people.filter((p) => {
    if (!p.userId || seen.has(p.userId)) return false;
    seen.add(p.userId);
    return true;
  });
}

function player(game: LiveTalkGame, userId: string): GamePlayer | undefined {
  return game.players.find((p) => p.userId === userId);
}

function activePlayers(game: LiveTalkGame): GamePlayer[] {
  return game.players.filter((p) => p.active);
}

function pickSecret(game: LiveTalkGame, rng: Rng): GameSecret {
  const pool =
    game.type === 'draw'
      ? contentForLevels(DRAW_WORDS, game.levels ?? levelsFromLegacy(game.level)).map((w) => ({
          en: w.en,
          th: w.th,
          category: w.category,
          ...(w.also ? { also: w.also } : {}),
        }))
      : contentForLevels(WHO_CHARACTERS, game.levels ?? levelsFromLegacy(game.level)).map((c) => ({ en: c.en, th: c.th, category: c.kind }));
  const fresh = pool.filter((s) => !game.used.includes(s.en));
  const from = fresh.length ? fresh : pool;
  const secret = from[Math.floor(rng() * from.length)] ?? from[0];
  game.used.push(secret.en);
  return secret;
}

function bump(game: LiveTalkGame) {
  game.seq += 1;
}

/** Next queued player who is still on stage, else game over. */
export function startNextTurn(game: LiveTalkGame, now: number, rng: Rng): void {
  if (game.type === 'chain') {
    startChainTurn(game, now);
    return;
  }
  while (game.queue.length) {
    const userId = game.queue.shift()!;
    if (!player(game, userId)?.active) continue;
    game.turnNumber += 1;
    game.phase = 'turn';
    game.phaseEndsAt = undefined;
    game.feed = [];
    game.turn = {
      userId,
      startedAt: now,
      endsAt: now + game.turnSeconds * 1000,
      secret: pickSecret(game, rng),
      changedWord: false,
      guessed: [],
      revealed: [],
    };
    bump(game);
    return;
  }
  endGame(game, now);
}

export function endGame(game: LiveTalkGame, now: number): void {
  if (game.phase === 'over') return;
  game.phase = 'over';
  game.phaseEndsAt = now + GAME_OVER_MS;
  game.queue = [];
  bump(game);
}

function endTurn(game: LiveTalkGame, result: TurnResult, now: number): void {
  if (!game.turn || game.phase !== 'turn') return;
  game.turn.result = result;
  if (game.type !== 'chain') game.answers.push({ en: game.turn.secret.en, th: game.turn.secret.th });
  game.phase = 'reveal';
  game.phaseEndsAt =
    now +
    (game.type === 'chain' ? (chainRoundEnds(game) ? CHAIN_ROUND_REVEAL_MS : CHAIN_REVEAL_MS) : REVEAL_MS);
  bump(game);
}

/** Drawer swaps the word once, within the first 10 s. */
export function changeWord(game: LiveTalkGame, userId: string, now: number, rng: Rng): void {
  const turn = game.turn;
  if (game.type !== 'draw' || game.phase !== 'turn' || !turn) throw new GameRuleError('no_turn');
  if (turn.userId !== userId) throw new GameRuleError('not_drawer');
  if (turn.changedWord) throw new GameRuleError('already_changed');
  if (now > turn.startedAt + CHANGE_WORD_WINDOW_MS) throw new GameRuleError('change_window_closed');
  // The old word stays in `used`, so it is not dealt again this game.
  turn.secret = pickSecret(game, rng);
  turn.changedWord = true;
  turn.revealed = [];
  bump(game);
}

export type GuessOutcome = { correct: boolean; heard: string };

/** Typed guesses: a short answer, not a list of words to try at once. */
export const TYPED_GUESS_MAX_WORDS = 3;

/** Draw & Guess: a typed answer (or a Game Mic transcript, older apps). */
export function submitGuess(
  game: LiveTalkGame,
  userId: string,
  transcript: string,
  now: number,
  opts: { typed?: boolean } = {},
): GuessOutcome {
  const turn = game.turn;
  if (game.type !== 'draw' || game.phase !== 'turn' || !turn) throw new GameRuleError('no_turn');
  const me = player(game, userId);
  if (!me?.active) throw new GameRuleError('not_playing');
  if (turn.userId === userId) throw new GameRuleError('drawer_cannot_guess');
  if (turn.guessed.includes(userId)) throw new GameRuleError('already_guessed');
  const last = game.lastGuessAt[userId] ?? 0;
  if (now - last < GUESS_COOLDOWN_MS) throw new GameRuleError('cooldown');
  game.lastGuessAt[userId] = now;
  const heard = shortHeard(transcript);
  if (!heard) throw new GameRuleError('empty_guess');
  const tooLong =
    opts.typed && normalizeSpeech(transcript).split(' ').filter(Boolean).length > TYPED_GUESS_MAX_WORDS;
  const correct = !tooLong && matchesAnswer(transcript, turn.secret);
  if (correct) {
    turn.guessed.push(userId);
    me.score += POINTS_RIGHT_GUESS;
    const drawer = player(game, turn.userId);
    if (drawer) drawer.score += POINTS_DRAWER_PER_GUESS;
    pushFeed(game, { userId, text: '', correct: true });
    const waiting = activePlayers(game).filter(
      (p) => p.userId !== turn.userId && !turn.guessed.includes(p.userId),
    );
    if (!waiting.length) endTurn(game, 'correct', now);
    else bump(game);
  } else {
    pushFeed(game, { userId, text: heard, correct: false });
    bump(game);
  }
  return { correct, heard };
}

function pushFeed(game: LiveTalkGame, item: GameFeedItem) {
  game.feed = [...game.feed, item].slice(-FEED_SIZE);
}

/**
 * Who Am I?: one of the asker's own final captions (forwarded by their app;
 * the captions agent follows the asker during the turn). Saying the card's
 * word ends the turn as correct; anything else is just a question.
 */
export function submitWhoCaption(
  game: LiveTalkGame,
  userId: string,
  transcript: string,
  now: number,
): GuessOutcome {
  const turn = game.turn;
  if (game.type !== 'who' || game.phase !== 'turn' || !turn) throw new GameRuleError('no_turn');
  if (turn.userId !== userId) throw new GameRuleError('not_asker');
  const heard = shortHeard(transcript);
  const correct = !!heard && matchesAnswer(transcript, turn.secret);
  if (correct) {
    awardWho(game, now);
    endTurn(game, 'correct', now);
  }
  return { correct, heard };
}

/** Who Am I?: someone who can see the card taps Correct! for the asker. */
export function confirmCorrect(game: LiveTalkGame, byUserId: string, now: number): void {
  const turn = game.turn;
  if (game.type !== 'who' || game.phase !== 'turn' || !turn) throw new GameRuleError('no_turn');
  if (turn.userId === byUserId) throw new GameRuleError('asker_cannot_confirm');
  // The host confirms. When the host is the one asking, any other player may.
  const by = player(game, byUserId);
  const hostAsking = turn.userId === game.hostUserId;
  if (hostAsking ? !by?.active : byUserId !== game.hostUserId) {
    throw new GameRuleError('host_only');
  }
  // A tap right at the start is a mis-tap (e.g. a Yes answer), not a guess.
  if (now - turn.startedAt < WHO_CONFIRM_LOCK_MS) throw new GameRuleError('too_early');
  awardWho(game, now);
  endTurn(game, 'correct', now);
}

function awardWho(game: LiveTalkGame, now: number): void {
  const turn = game.turn!;
  const points = whoPointsAt(turn, now);
  turn.points = points;
  turn.solvedMs = Math.max(0, now - turn.startedAt);
  const asker = player(game, turn.userId);
  if (asker) asker.score += points;
}

/**
 * Advance timers. Returns `'ended'` once the game-over popup has run, so the
 * service can drop the game.
 */
export function tick(game: LiveTalkGame, now: number, rng: Rng): 'ended' | 'changed' | 'idle' {
  if (game.phase === 'over') {
    return game.phaseEndsAt !== undefined && now >= game.phaseEndsAt ? 'ended' : 'idle';
  }
  if (game.phase === 'reveal') {
    if (game.phaseEndsAt !== undefined && now >= game.phaseEndsAt) {
      startNextTurn(game, now, rng);
      return 'changed';
    }
    return 'idle';
  }
  const turn = game.turn;
  if (!turn) return 'idle';
  if (game.type === 'chain') return tickChain(game, turn, now);
  if (now >= turn.endsAt) {
    endTurn(game, 'timeup', now);
    return 'changed';
  }
  if (game.type === 'draw') {
    const want = hintIndexesAt(turn.secret.en, (now - turn.startedAt) / (turn.endsAt - turn.startedAt));
    if (want.length > turn.revealed.length) {
      turn.revealed = want;
      bump(game);
      return 'changed';
    }
  }
  return 'idle';
}

/** Letters revealed by elapsed fraction: first letter at 40%, a middle one at 65%. */
export function hintIndexesAt(word: string, fraction: number): number[] {
  const letters = [...word].map((ch, i) => (/[a-z]/i.test(ch) ? i : -1)).filter((i) => i >= 0);
  const out: number[] = [];
  if (fraction >= HINT_AT[0] && letters.length > 2) out.push(letters[0]);
  if (fraction >= HINT_AT[1] && letters.length > 3) out.push(letters[Math.floor(letters.length / 2)]);
  return out;
}

/**
 * Who is on stage now. Off-stage players go inactive (score kept); returning
 * players are active again. The current drawer/asker leaving skips the turn;
 * the host leaving or fewer than 2 players ends the game.
 */
export function syncSpeakers(
  game: LiveTalkGame,
  speakers: GamePerson[],
  now: number,
): 'changed' | 'idle' {
  if (game.phase === 'over') return 'idle';
  const onStage = new Set(speakers.map((s) => s.userId));
  let changed = false;
  for (const p of game.players) {
    const active = onStage.has(p.userId);
    if (p.active !== active) {
      p.active = active;
      changed = true;
    }
    const fresh = speakers.find((s) => s.userId === p.userId);
    if (fresh && (fresh.name !== p.name || (fresh.avatarId ?? null) !== (p.avatarId ?? null))) {
      p.name = fresh.name;
      p.avatarId = fresh.avatarId ?? null;
      changed = true;
    }
  }
  if (!onStage.has(game.hostUserId) || activePlayers(game).length < GAME_MIN_PLAYERS) {
    endGame(game, now);
    return 'changed';
  }
  if (game.phase === 'turn' && game.turn && !player(game, game.turn.userId)?.active) {
    endTurn(game, 'skipped', now);
    return 'changed';
  }
  // Word Chain: one player left in the race → wrap up (the reveal hands over
  // to startNextTurn, which ends the game with the survivor bonus).
  if (game.phase === 'turn' && game.type === 'chain' && chainAlive(game).length < GAME_MIN_PLAYERS) {
    endTurn(game, 'skipped', now);
    return 'changed';
  }
  if (game.phase === 'turn' && game.type === 'draw' && game.turn) {
    const turn = game.turn;
    const waiting = activePlayers(game).filter(
      (p) => p.userId !== turn.userId && !turn.guessed.includes(p.userId),
    );
    if (!waiting.length && turn.guessed.length) {
      endTurn(game, 'correct', now);
      return 'changed';
    }
  }
  if (changed) bump(game);
  return changed ? 'changed' : 'idle';
}

// ---------------------------------------------------------------------------
// Answer matching (no LLM): normalise, exact / plural, phrase, then a 1-edit
// fuzzy match for longer words so "elefant" counts but "cat" ≠ "cut".

export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' -]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortHeard(transcript: string): string {
  return normalizeSpeech(transcript).split(' ').filter(Boolean).slice(-4).join(' ');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

function forms(word: string): string[] {
  const out = [word, `${word}s`, `${word}es`];
  if (word.endsWith('y')) out.push(`${word.slice(0, -1)}ies`);
  if (word.endsWith('s')) out.push(word.slice(0, -1));
  return out;
}

export function matchesAnswer(transcript: string, secret: Pick<GameSecret, 'en' | 'also'>): boolean {
  const text = normalizeSpeech(transcript);
  if (!text) return false;
  const tokens = text.split(' ');
  const padded = ` ${text} `;
  for (const raw of [secret.en, ...(secret.also ?? [])]) {
    const answer = normalizeSpeech(raw);
    if (!answer) continue;
    if (answer.includes(' ')) {
      if (padded.includes(` ${answer} `) || padded.includes(` ${answer.replace(/ /g, '')} `)) return true;
      continue;
    }
    const ok = forms(answer);
    if (tokens.some((t) => ok.includes(t))) return true;
    if (answer.length >= 5 && tokens.some((t) => t.length >= 5 && levenshtein(t, answer) <= 1)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// What clients see. Public state never carries the secret during a turn;
// `secretFor` decides who may see it.

export function publicView(game: LiveTalkGame, now: number) {
  const turn = game.turn;
  const revealing = game.phase !== 'turn';
  return {
    id: game.id,
    type: game.type,
    level: game.level,
    levels: game.levels,
    turnSeconds: game.turnSeconds,
    phase: game.phase,
    phaseEndsAt: game.phaseEndsAt ?? null,
    seq: game.seq,
    serverNow: now,
    turnNumber: game.turnNumber,
    totalTurns: game.totalTurns,
    hostUserId: game.hostUserId,
    players: game.players.map((p) => ({
      userId: p.userId,
      name: p.name,
      avatarId: p.avatarId ?? null,
      score: p.score,
      active: p.active,
    })),
    turn: turn
      ? {
          userId: turn.userId,
          startedAt: turn.startedAt,
          endsAt: turn.endsAt,
          changeWordUntil:
            game.type === 'draw' && !turn.changedWord ? turn.startedAt + CHANGE_WORD_WINDOW_MS : null,
          guessed: turn.guessed,
          result: turn.result ?? null,
          points: turn.points ?? null,
          solvedMs: turn.solvedMs ?? null,
          word: turn.word ?? null,
          pending: game.type === 'chain' && turn.pending ? turn.pending : null,
          pausedLeftMs: game.type === 'chain' && turn.pending ? turn.pausedLeftMs ?? 0 : null,
          hint:
            game.type === 'draw'
              ? {
                  category: turn.secret.category ?? null,
                  pattern: [...turn.secret.en].map((ch, i) =>
                    ch === ' ' ? ' ' : revealing || turn.revealed.includes(i) ? ch : '_',
                  ),
                  /**
                   * Words of this category at this level — only to bias the
                   * Game Mic's speech-to-text (never shown). Includes the
                   * answer among many, so it gives nothing away.
                   */
                  vocab: game.phase === 'turn' ? vocabForTurn(game.levels ?? game.level, turn.secret, turn.startedAt) : [],
                }
              : null,
          answer: revealing && game.type !== 'chain' ? { en: turn.secret.en, th: turn.secret.th } : null,
        }
      : null,
    feed: game.feed,
    /** Reveal: who goes next (first queued player still on stage). */
    nextUserId:
      game.phase !== 'reveal'
        ? null
        : game.type === 'chain'
          ? chainNextUserId(game)
          : game.queue.find((id) => game.players.some((p) => p.userId === id && p.active)) ?? null,
    words: game.phase === 'over' ? game.answers : [],
    chain: game.chain ? chainView(game, game.chain) : null,
  };
}

const STT_VOCAB_MAX = 24;

/**
 * Draw words of the answer's category (with alternative spellings) for STT
 * biasing: always contains the answer, at most 24 words (the app's prompt
 * cap), alphabetical so the answer's position gives nothing away.
 */
export function vocabForTurn(
  level: LiveTalkGameLevel | readonly LiveTalkGameLevel[],
  secret: Pick<GameSecret, 'en' | 'also' | 'category'>,
  seed: number,
): string[] {
  const answer = [secret.en, ...(secret.also ?? [])];
  const others = secret.category
    ? contentForLevels(DRAW_WORDS, typeof level === 'string' ? levelsFromLegacy(level) : level)
        .filter((w) => w.category === secret.category && w.en !== secret.en)
        .flatMap((w) => [w.en, ...(w.also ?? [])])
    : [];
  const hash = (word: string) => {
    let h = seed | 0;
    for (const ch of word) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
    return h;
  };
  const picked = others
    .sort((a, b) => hash(a) - hash(b))
    .slice(0, Math.max(0, STT_VOCAB_MAX - answer.length));
  return [...new Set([...answer, ...picked])].sort((a, b) => a.localeCompare(b));
}

/**
 * Draw: only the drawer sees the word. Who Am I?: everyone in the room
 * (players and listeners) except the asker sees the card.
 */
export function secretFor(game: LiveTalkGame, userId: string): GameSecret | null {
  const turn = game.turn;
  if (!turn || game.phase !== 'turn') return null;
  if (game.type === 'chain') return null;
  const { en, th, category } = turn.secret;
  const view = { en, th, ...(category ? { category } : {}) };
  if (game.type === 'draw') return turn.userId === userId ? view : null;
  return turn.userId === userId ? null : view;
}

// ---------------------------------------------------------------------------
// Word Chain

function chainAlive(game: LiveTalkGame): GamePlayer[] {
  const out = game.chain?.out ?? [];
  return game.players.filter((p) => p.active && !out.includes(p.userId));
}

/** No one left in this round's queue → the next turn starts a new round. */
function chainRoundEnds(game: LiveTalkGame): boolean {
  const alive = new Set(chainAlive(game).map((p) => p.userId));
  return !game.queue.some((id) => alive.has(id));
}

function chainNextUserId(game: LiveTalkGame): string | null {
  const alive = new Set(chainAlive(game).map((p) => p.userId));
  if (alive.size < GAME_MIN_PLAYERS) return null;
  const chain = game.chain!;
  if (chainRoundEnds(game) && chain.round >= CHAIN_MAX_ROUNDS) return null;
  return game.queue.find((id) => alive.has(id)) ?? chain.order.find((id) => alive.has(id)) ?? null;
}

function startChainTurn(game: LiveTalkGame, now: number): void {
  const chain = game.chain!;
  // At most one new round per call (the queue is refilled once).
  for (let pass = 0; pass < 2; pass++) {
    if (chainAlive(game).length < GAME_MIN_PLAYERS) break;
    const alive = new Set(chainAlive(game).map((p) => p.userId));
    while (game.queue.length) {
      const userId = game.queue.shift()!;
      if (!alive.has(userId)) continue;
      const seconds = chainSecondsFor(chain.startSeconds, chain.round);
      game.turnSeconds = seconds;
      game.turnNumber += 1;
      game.phase = 'turn';
      game.phaseEndsAt = undefined;
      game.feed = [];
      game.turn = {
        userId,
        startedAt: now,
        endsAt: now + seconds * 1000,
        secret: { en: chain.letter, th: '' },
        changedWord: false,
        guessed: [],
        revealed: [],
        pending: null,
      };
      bump(game);
      return;
    }
    if (chain.round >= CHAIN_MAX_ROUNDS) break;
    chain.round += 1;
    game.queue = chain.order.filter((id) => alive.has(id));
  }
  // Last one standing (or everyone still in after the last round): bonus.
  for (const p of chainAlive(game)) p.score += CHAIN_SURVIVOR_BONUS;
  endGame(game, now);
}

function tickChain(game: LiveTalkGame, turn: GameTurn, now: number): 'changed' | 'idle' {
  if (turn.pending) {
    if (now < turn.pending.until) return 'idle';
    // No "นับให้": the clock runs again and the player may try another word.
    turn.pending = null;
    turn.endsAt = now + Math.max(turn.pausedLeftMs ?? 0, CHAIN_RESUME_MIN_MS);
    turn.pausedLeftMs = undefined;
    bump(game);
    return 'changed';
  }
  if (now < turn.endsAt + CHAIN_GRACE_MS) return 'idle';
  const chain = game.chain!;
  const left = (chain.hearts[turn.userId] ?? CHAIN_HEARTS) - 1;
  chain.hearts[turn.userId] = Math.max(0, left);
  if (left <= 0 && !chain.out.includes(turn.userId)) chain.out.push(turn.userId);
  endTurn(game, 'timeup', now);
  return 'changed';
}

function lastLetter(word: string): string {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');
  return letters[letters.length - 1] ?? '';
}

function acceptChainWord(game: LiveTalkGame, word: string, now: number, rng: Rng): void {
  const turn = game.turn!;
  const chain = game.chain!;
  turn.word = word;
  turn.pending = null;
  turn.pausedLeftMs = undefined;
  turn.points = CHAIN_POINTS_WORD;
  turn.solvedMs = Math.max(0, now - turn.startedAt);
  const me = player(game, turn.userId);
  if (me) me.score += CHAIN_POINTS_WORD;
  chain.words.push({ userId: turn.userId, en: word });
  game.answers.push({ en: word, th: '' });
  chain.prevWord = word;
  chain.prevUserId = turn.userId;
  const last = lastLetter(word);
  if (!last || (CHAIN_REROLL_FROM as readonly string[]).includes(last)) {
    chain.rerolledFrom = last || null;
    chain.letter = CHAIN_START_LETTERS[Math.floor(rng() * CHAIN_START_LETTERS.length)] ?? 's';
  } else {
    chain.rerolledFrom = null;
    chain.letter = last;
  }
  endTurn(game, 'correct', now);
}

/**
 * Word Chain: one of the player's own final captions. The last word in the
 * line that starts with the letter, is in CHAIN_WORDS and was not used counts.
 * An unknown word with the right letter stops the clock for the host.
 */
export function submitChainCaption(
  game: LiveTalkGame,
  userId: string,
  transcript: string,
  now: number,
  rng: Rng,
): GuessOutcome {
  const turn = game.turn;
  const chain = game.chain;
  if (game.type !== 'chain' || game.phase !== 'turn' || !turn || !chain) throw new GameRuleError('no_turn');
  if (turn.userId !== userId) throw new GameRuleError('not_your_turn');
  const heard = shortHeard(transcript);
  if (turn.pending || !heard) return { correct: false, heard };
  const used = new Set(chain.words.map((w) => w.en));
  const starts = normalizeSpeech(transcript)
    .split(' ')
    .filter((t) => /^[a-z]{2,}$/.test(t) && t.startsWith(chain.letter));
  const fresh = starts.filter((t) => CHAIN_WORDS.has(t) && !used.has(t));
  if (fresh.length) {
    acceptChainWord(game, fresh[fresh.length - 1], now, rng);
    return { correct: true, heard };
  }
  const unknown = starts.filter((t) => !CHAIN_WORDS.has(t) && t.length >= 3);
  const said = starts.filter((t) => used.has(t));
  if (unknown.length) {
    const word = unknown[unknown.length - 1];
    turn.pending = { word, until: now + CHAIN_OVERRIDE_MS };
    turn.pausedLeftMs = Math.max(0, turn.endsAt - now);
    pushFeed(game, { userId, text: word, correct: false, note: 'unknown' });
  } else if (said.length) {
    pushFeed(game, { userId, text: said[said.length - 1], correct: false, note: 'used' });
  } else {
    pushFeed(game, { userId, text: heard, correct: false, note: 'letter' });
  }
  bump(game);
  return { correct: false, heard };
}

/**
 * Word Chain "นับให้": the host counts the unknown word. When the host is the
 * one playing, any other player may.
 */
export function acceptPendingWord(game: LiveTalkGame, byUserId: string, now: number, rng: Rng): void {
  const turn = game.turn;
  if (game.type !== 'chain' || game.phase !== 'turn' || !turn) throw new GameRuleError('no_turn');
  if (!turn.pending) throw new GameRuleError('nothing_pending');
  if (turn.userId === byUserId) throw new GameRuleError('player_cannot_confirm');
  const by = player(game, byUserId);
  const hostPlaying = turn.userId === game.hostUserId;
  if (hostPlaying ? !by?.active : byUserId !== game.hostUserId) throw new GameRuleError('host_only');
  acceptChainWord(game, turn.pending.word, now, rng);
}

function chainView(game: LiveTalkGame, chain: ChainState) {
  const roundEnds = game.phase === 'reveal' && chainRoundEnds(game) && chain.round < CHAIN_MAX_ROUNDS;
  return {
    round: chain.round,
    maxRounds: CHAIN_MAX_ROUNDS,
    letter: chain.letter,
    prevWord: chain.prevWord,
    prevUserId: chain.prevUserId,
    rerolledFrom: chain.rerolledFrom,
    startSeconds: chain.startSeconds,
    seconds: chainSecondsFor(chain.startSeconds, chain.round),
    /** Reveal before a new round: the new (shorter) time, for the banner. */
    nextSeconds: roundEnds ? chainSecondsFor(chain.startSeconds, chain.round + 1) : null,
    maxHearts: CHAIN_HEARTS,
    hearts: chain.hearts,
    out: chain.out,
    words: chain.words.map((w) => w.en),
  };
}
