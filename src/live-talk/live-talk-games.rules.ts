import {
  contentForLevel,
  DRAW_WORDS,
  WHO_CHARACTERS,
  type LiveTalkGameLevel,
} from './live-talk-games.content';

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
 * - Who Am I?: one turn each; the asker keeps asking until someone taps
 *   Correct! or time is up (60/90/120 s, default 90). Right = +10.
 * - Reveal 3 s between turns; game over popup 8 s. Fewer than 2 players or
 *   the host gone → game over.
 */
export type LiveTalkGameType = 'draw' | 'who';
export type LiveTalkGamePhase = 'turn' | 'reveal' | 'over';
export type TurnResult = 'correct' | 'timeup' | 'skipped';

export const GAME_MIN_PLAYERS = 2;
export const DRAW_TURN_SECONDS = [30, 45, 60] as const;
export const WHO_TURN_SECONDS = [60, 90, 120] as const;
export const DRAW_DEFAULT_SECONDS = 45;
export const WHO_DEFAULT_SECONDS = 90;
export const DRAW_ROUNDS_EACH = 2;
export const WHO_ROUNDS_EACH = 1;
export const CHANGE_WORD_WINDOW_MS = 10_000;
export const GUESS_COOLDOWN_MS = 2_000;
export const REVEAL_MS = 3_000;
export const GAME_OVER_MS = 8_000;
export const HINT_AT = [0.4, 0.65] as const;
export const POINTS_RIGHT_GUESS = 10;
export const POINTS_DRAWER_PER_GUESS = 5;
export const POINTS_WHO_CORRECT = 10;
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
};

export type GameFeedItem = { userId: string; text: string; correct: boolean };

export type LiveTalkGame = {
  id: string;
  roomId: string;
  type: LiveTalkGameType;
  level: LiveTalkGameLevel;
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
  return value === 'draw' || value === 'who';
}

export function normalizeTurnSeconds(type: LiveTalkGameType, seconds: unknown): number {
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
  turnSeconds?: number;
  hostUserId: string;
  speakers: GamePerson[];
  now: number;
  rng: Rng;
}): LiveTalkGame {
  const people = dedupe(input.speakers);
  if (people.length < GAME_MIN_PLAYERS) throw new GameRuleError('not_enough_players');
  const rounds = input.type === 'draw' ? DRAW_ROUNDS_EACH : WHO_ROUNDS_EACH;
  const order = shuffle(people.map((p) => p.userId), input.rng);
  const queue: string[] = [];
  for (let r = 0; r < rounds; r++) queue.push(...order);
  const game: LiveTalkGame = {
    id: input.id,
    roomId: input.roomId,
    type: input.type,
    level: input.level,
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
      ? contentForLevel(DRAW_WORDS, game.level).map((w) => ({
          en: w.en,
          th: w.th,
          category: w.category,
          ...(w.also ? { also: w.also } : {}),
        }))
      : contentForLevel(WHO_CHARACTERS, game.level).map((c) => ({ en: c.en, th: c.th, category: c.kind }));
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
  game.answers.push({ en: game.turn.secret.en, th: game.turn.secret.th });
  game.phase = 'reveal';
  game.phaseEndsAt = now + REVEAL_MS;
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

/** Draw & Guess: a Game Mic transcript from a guesser. */
export function submitGuess(
  game: LiveTalkGame,
  userId: string,
  transcript: string,
  now: number,
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
  const correct = matchesAnswer(transcript, turn.secret);
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

/** Who Am I?: someone who can see the card taps Correct! for the asker. */
export function confirmCorrect(game: LiveTalkGame, byUserId: string, now: number): void {
  const turn = game.turn;
  if (game.type !== 'who' || game.phase !== 'turn' || !turn) throw new GameRuleError('no_turn');
  if (turn.userId === byUserId) throw new GameRuleError('asker_cannot_confirm');
  const by = player(game, byUserId);
  if (!by?.active && byUserId !== game.hostUserId) throw new GameRuleError('not_playing');
  const asker = player(game, turn.userId);
  if (asker) asker.score += POINTS_WHO_CORRECT;
  endTurn(game, 'correct', now);
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
          hint:
            game.type === 'draw'
              ? {
                  category: turn.secret.category ?? null,
                  pattern: [...turn.secret.en].map((ch, i) =>
                    ch === ' ' ? ' ' : revealing || turn.revealed.includes(i) ? ch : '_',
                  ),
                }
              : null,
          answer: revealing ? { en: turn.secret.en, th: turn.secret.th } : null,
        }
      : null,
    feed: game.feed,
    /** Reveal: who goes next (first queued player still on stage). */
    nextUserId:
      game.phase === 'reveal'
        ? game.queue.find((id) => game.players.some((p) => p.userId === id && p.active)) ?? null
        : null,
    words: game.phase === 'over' ? game.answers : [],
  };
}

/**
 * Draw: only the drawer sees the word. Who Am I?: everyone in the room
 * (players and listeners) except the asker sees the card.
 */
export function secretFor(game: LiveTalkGame, userId: string): GameSecret | null {
  const turn = game.turn;
  if (!turn || game.phase !== 'turn') return null;
  const { en, th, category } = turn.secret;
  const view = { en, th, ...(category ? { category } : {}) };
  if (game.type === 'draw') return turn.userId === userId ? view : null;
  return turn.userId === userId ? null : view;
}
