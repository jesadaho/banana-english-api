import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPaymentClosureFromAiReply,
  applyPaymentClosureIfNeeded,
  applySimulationCheckpointHeuristics,
  finalizeSimulationTurnState,
  getSimulation,
  initCheckpointStates,
  meetNewFriendMinimumProgressMet,
  mergeCheckpoints,
  type SimulationConfig,
} from './simulations.data';

type Turn = { speaker: 'user' | 'ai'; textEn: string };

function requireMission(id: string): SimulationConfig {
  const config = getSimulation(id);
  assert.ok(config, `missing simulation ${id}`);
  return config;
}

function normalizeGeminiCheckpoints(
  criteria: string[],
  updated: Record<string, boolean> = {},
): Record<string, boolean> {
  return Object.fromEntries(
    criteria.map((key) => [key, Boolean(updated[key])]),
  );
}

/** Same order as `processSimulationTurn` — Gemini merge, payment closures, heuristics, finalize. */
function runMissionTurn(args: {
  config: SimulationConfig;
  checkpoints: Record<string, boolean>;
  history: Turn[];
  nextTurn: number;
  userText: string;
  geminiCheckpoints?: Record<string, boolean>;
  aiResponse: string;
  textTh?: string;
}): {
  checkpoints: Record<string, boolean>;
  reply: { aiResponse: string; textTh: string };
  isTaskComplete: boolean;
  history: Turn[];
} {
  const history: Turn[] = [
    ...args.history,
    { speaker: 'user', textEn: args.userText },
  ];
  const merged = applyPaymentClosureFromAiReply(
    args.config,
    args.aiResponse,
    applyPaymentClosureIfNeeded(
      args.config,
      args.userText,
      mergeCheckpoints(
        args.checkpoints,
        normalizeGeminiCheckpoints(
          args.config.successCriteria,
          args.geminiCheckpoints,
        ),
      ),
    ),
  );
  const heuristic = applySimulationCheckpointHeuristics(
    args.config,
    args.userText,
    history,
    merged,
    args.aiResponse,
  );
  const finalized = finalizeSimulationTurnState(
    args.config,
    args.nextTurn,
    heuristic,
    { aiResponse: args.aiResponse, textTh: args.textTh ?? '' },
    history,
  );
  history.push({ speaker: 'ai', textEn: finalized.reply.aiResponse });
  return { ...finalized, history };
}

const COFFEE_ID = 'coffee_order_easy';
const FRIEND_ID = 'meet_new_friend_easy';
const FOUNDATION_MISSION_IDS = [
  'foundation_first_conversation',
  'foundation_survival_help',
  'foundation_talk_about_family',
  'foundation_buy_something',
  'foundation_three_things_about_me',
  'foundation_ask_for_a_place',
];

describe('Foundation missions — fixed beginner arc', () => {
  for (const id of FOUNDATION_MISSION_IDS) {
    it(`${id} costs one banana and requires exactly three learner replies`, () => {
      const mission = requireMission(id);
      assert.equal(mission.foundationMission, true);
      assert.equal(mission.bananaCost, 1);
      assert.equal(mission.maxTurns, 3);
      assert.equal(mission.goalsEn.length, 3);
      assert.equal(mission.goalsTh.length, 3);
      assert.equal(mission.successCriteria.length, 3);
      assert.ok(mission.completionReplyEn);
      assert.ok(mission.completionReplyTh);
    });
  }

  it('does not complete early even if Gemini marks every checkpoint true', () => {
    const mission = requireMission('foundation_first_conversation');
    const checkpoints = Object.fromEntries(
      mission.successCriteria.map((key) => [key, true]),
    );

    const finalized = finalizeSimulationTurnState(
      mission,
      2,
      checkpoints,
      {
        aiResponse: 'Great! Where do you live?',
        textTh: 'เยี่ยมครับ! คุณอาศัยอยู่ที่ไหนครับ',
      },
    );

    assert.equal(finalized.isTaskComplete, false);
    assert.equal(finalized.reply.aiResponse, 'Great! Where do you live?');
  });

  it('closes deterministically after the third learner reply', () => {
    const mission = requireMission('foundation_first_conversation');
    const finalized = finalizeSimulationTurnState(
      mission,
      3,
      initCheckpointStates(mission.successCriteria),
      {
        aiResponse: 'Great! What do you do?',
        textTh: 'เยี่ยมครับ! คุณทำงานอะไรครับ',
      },
    );

    assert.equal(finalized.isTaskComplete, true);
    assert.equal(finalized.reply.aiResponse, mission.completionReplyEn);
    assert.equal(finalized.reply.textTh, mission.completionReplyTh);
    assert.equal(finalized.reply.aiResponse.includes('?'), false);
    assert.ok(Object.values(finalized.checkpoints).every(Boolean));
  });
});

describe('mission catalog — first two', () => {
  it('coffee_order_easy has 3 goals and payment checkpoints', () => {
    const coffee = requireMission(COFFEE_ID);
    assert.equal(coffee.goalsTh.length, 3);
    assert.equal(coffee.goalsEn.length, 3);
    assert.deepEqual(coffee.successCriteria, [
      'ordered_drink',
      'asked_price',
      'payment_completed',
    ]);
    assert.equal(coffee.maxTurns, 8);
  });

  it('meet_new_friend_easy has 3 social-arc checkpoints', () => {
    const friend = requireMission(FRIEND_ID);
    assert.equal(friend.goalsTh.length, 3);
    assert.equal(friend.goalsEn.length, 3);
    assert.deepEqual(friend.successCriteria, [
      'introduced_self',
      'answered_about_self',
      'got_to_know_friend',
    ]);
    assert.equal(friend.maxTurns, 8);
  });
});

describe('coffee_order_easy — 3 scenarios', () => {
  it('scenario 1 — happy path: order, price, card → complete', () => {
    const coffee = requireMission(COFFEE_ID);
    let checkpoints = initCheckpointStates(coffee.successCriteria);
    let history: Turn[] = [
      { speaker: 'ai', textEn: 'Hi! What can I get started for you today?' },
    ];

    let turn = runMissionTurn({
      config: coffee,
      checkpoints,
      history,
      nextTurn: 1,
      userText: "I'd like a latte.",
      geminiCheckpoints: { ordered_drink: true },
      aiResponse: 'Sure! Anything else?',
    });
    checkpoints = turn.checkpoints;
    history = turn.history;
    assert.equal(checkpoints.ordered_drink, true);
    assert.equal(checkpoints.asked_price, false);
    assert.equal(checkpoints.payment_completed, false);
    assert.equal(turn.isTaskComplete, false);

    turn = runMissionTurn({
      config: coffee,
      checkpoints,
      history,
      nextTurn: 2,
      userText: 'How much is it?',
      geminiCheckpoints: { asked_price: true },
      aiResponse: "It's five dollars.",
    });
    checkpoints = turn.checkpoints;
    history = turn.history;
    assert.equal(checkpoints.asked_price, true);
    assert.equal(checkpoints.payment_completed, false);
    assert.equal(turn.isTaskComplete, false);

    turn = runMissionTurn({
      config: coffee,
      checkpoints,
      history,
      nextTurn: 3,
      userText: 'Card please.',
      aiResponse: 'Here is your latte! Enjoy your day!',
    });
    assert.equal(turn.checkpoints.payment_completed, true);
    assert.equal(turn.isTaskComplete, true);
  });

  it('scenario 2 — messy STT: garbled card still closes payment after drink+price', () => {
    const coffee = requireMission(COFFEE_ID);
    const ready = {
      ordered_drink: true,
      asked_price: true,
      payment_completed: false,
    };

    for (const utterance of ['hard plates', 'plates please', 'cutting', "I'll pay"]) {
      const turn = runMissionTurn({
        config: coffee,
        checkpoints: { ...ready },
        history: [],
        nextTurn: 4,
        userText: utterance,
        aiResponse: 'Great!',
      });
      assert.equal(
        turn.checkpoints.payment_completed,
        true,
        `${utterance} should close payment`,
      );
      assert.equal(turn.isTaskComplete, true, `${utterance} should complete`);
    }

    const fromAi = runMissionTurn({
      config: coffee,
      checkpoints: { ...ready },
      history: [],
      nextTurn: 4,
      userText: 'thanks',
      aiResponse: 'Card, got it! Payment completed. Here is your latte!',
    });
    assert.equal(fromAi.checkpoints.payment_completed, true);

    const tooEarly = runMissionTurn({
      config: coffee,
      checkpoints: {
        ordered_drink: true,
        asked_price: false,
        payment_completed: false,
      },
      history: [],
      nextTurn: 2,
      userText: 'hard plates',
      aiResponse: 'Sure!',
    });
    assert.equal(tooEarly.checkpoints.payment_completed, false);
    assert.equal(tooEarly.isTaskComplete, false);
  });

  it('scenario 3 — stuck: do not finish early; force-close at maxTurns without another question', () => {
    const coffee = requireMission(COFFEE_ID);
    const looping = runMissionTurn({
      config: coffee,
      checkpoints: {
        ordered_drink: true,
        asked_price: false,
        payment_completed: false,
      },
      history: [],
      nextTurn: 6,
      userText: 'latte',
      geminiCheckpoints: { ordered_drink: true },
      aiResponse: 'Anything else?',
    });
    assert.equal(looping.isTaskComplete, false);
    assert.equal(looping.checkpoints.asked_price, false);
    assert.match(looping.reply.aiResponse, /\?/);

    const lastTurn = runMissionTurn({
      config: coffee,
      checkpoints: {
        ordered_drink: true,
        asked_price: false,
        payment_completed: false,
      },
      history: [],
      nextTurn: 8,
      userText: 'um',
      aiResponse: 'Anything else today?',
    });
    assert.equal(lastTurn.isTaskComplete, true);
    assert.equal(lastTurn.checkpoints.asked_price, true);
    assert.equal(lastTurn.checkpoints.payment_completed, true);
    assert.doesNotMatch(lastTurn.reply.aiResponse, /\?/);
  });
});

describe('meet_new_friend_easy — 3 scenarios', () => {
  it('scenario 1 — happy path: intro, two self answers, ask Max → complete at turn 5', () => {
    const friend = requireMission(FRIEND_ID);
    let checkpoints = initCheckpointStates(friend.successCriteria);
    let history: Turn[] = [
      { speaker: 'ai', textEn: "Hi! I'm Max. Nice to meet you." },
    ];

    const beats: Array<{
      userText: string;
      aiResponse: string;
      nextTurn: number;
    }> = [
      {
        userText: "Hi, I'm Nana.",
        aiResponse: 'Nice! Where are you from?',
        nextTurn: 1,
      },
      {
        userText: "I'm from Bangkok.",
        aiResponse: 'Cool! What do you do?',
        nextTurn: 2,
      },
      {
        userText: 'I work at a school.',
        aiResponse: 'I work nearby. I like football.',
        nextTurn: 3,
      },
      {
        userText: 'What do you like, Max?',
        aiResponse: 'I like cooking too!',
        nextTurn: 4,
      },
      {
        userText: "That's cool!",
        aiResponse: 'Nice talking to you!',
        nextTurn: 5,
      },
    ];

    let turn: ReturnType<typeof runMissionTurn> | undefined;
    for (const beat of beats) {
      turn = runMissionTurn({
        config: friend,
        checkpoints,
        history,
        nextTurn: beat.nextTurn,
        userText: beat.userText,
        aiResponse: beat.aiResponse,
      });
      checkpoints = turn.checkpoints;
      history = turn.history;
      if (beat.nextTurn < 5) {
        assert.equal(
          turn.isTaskComplete,
          false,
          `should not complete at turn ${beat.nextTurn}`,
        );
      }
    }

    assert.ok(turn);
    assert.equal(turn.checkpoints.introduced_self, true);
    assert.equal(turn.checkpoints.answered_about_self, true);
    assert.equal(turn.checkpoints.got_to_know_friend, true);
    assert.equal(meetNewFriendMinimumProgressMet(5, turn.history), true);
    assert.equal(turn.isTaskComplete, true);
  });

  it('scenario 2 — messy: Gemini marks all goals after one hello — heuristic keeps the mission open', () => {
    const friend = requireMission(FRIEND_ID);
    const turn = runMissionTurn({
      config: friend,
      checkpoints: initCheckpointStates(friend.successCriteria),
      history: [{ speaker: 'ai', textEn: "Hi! I'm Max. Nice to meet you." }],
      nextTurn: 1,
      userText: "Hi, I'm Nana.",
      geminiCheckpoints: {
        introduced_self: true,
        answered_about_self: true,
        got_to_know_friend: true,
      },
      aiResponse: 'Where are you from?',
    });

    assert.equal(turn.checkpoints.introduced_self, true);
    assert.equal(turn.checkpoints.answered_about_self, false);
    assert.equal(turn.checkpoints.got_to_know_friend, false);
    assert.equal(turn.isTaskComplete, false);
    assert.equal(meetNewFriendMinimumProgressMet(1, turn.history), false);
  });

  it('AI closes after studying — honor close even before turn 5', () => {
    const friend = requireMission(FRIEND_ID);
    const history: Turn[] = [
      { speaker: 'ai', textEn: "Hi! I'm Max. Nice to meet you." },
      { speaker: 'user', textEn: "Hi, I'm Jim." },
      { speaker: 'ai', textEn: 'Nice! Where are you from?' },
      { speaker: 'user', textEn: "I'm from Thailand." },
      {
        speaker: 'ai',
        textEn: 'Thailand is beautiful! Do you work or study there, Jim?',
      },
    ];

    const turn = runMissionTurn({
      config: friend,
      checkpoints: initCheckpointStates(friend.successCriteria),
      history,
      nextTurn: 3,
      userText: "I'm studying.",
      aiResponse:
        'That is wonderful! I am a software developer and love jogging. Nice talking to you!',
    });

    assert.equal(turn.checkpoints.introduced_self, true);
    assert.equal(turn.checkpoints.answered_about_self, true);
    assert.equal(turn.checkpoints.got_to_know_friend, true);
    assert.equal(turn.isTaskComplete, true);
  });

  it('scenario 3 — stuck: 2 goals near the end force-close; maxTurns still finishes', () => {
    const friend = requireMission(FRIEND_ID);
    const twoGoals = {
      introduced_self: true,
      answered_about_self: true,
      got_to_know_friend: false,
    };
    const history: Turn[] = [
      { speaker: 'ai', textEn: "Hi! I'm Max. Nice to meet you." },
      { speaker: 'user', textEn: "I'm Nana." },
      { speaker: 'ai', textEn: 'Where are you from?' },
      { speaker: 'user', textEn: "I'm from Bangkok." },
      { speaker: 'ai', textEn: 'What do you do?' },
      { speaker: 'user', textEn: 'I work at a school.' },
      { speaker: 'ai', textEn: 'What do you like?' },
    ];

    const nearEnd = runMissionTurn({
      config: friend,
      checkpoints: twoGoals,
      history,
      nextTurn: 6,
      userText: 'I like music.',
      geminiCheckpoints: twoGoals,
      aiResponse: 'What else do you like?',
    });
    assert.equal(nearEnd.isTaskComplete, true);
    assert.equal(nearEnd.checkpoints.got_to_know_friend, true);
    assert.doesNotMatch(nearEnd.reply.aiResponse, /\?/);

    const maxed = runMissionTurn({
      config: friend,
      checkpoints: initCheckpointStates(friend.successCriteria),
      history: [{ speaker: 'ai', textEn: "Hi! I'm Max. Nice to meet you." }],
      nextTurn: 8,
      userText: 'um',
      aiResponse: "What's your name?",
    });
    assert.equal(maxed.isTaskComplete, true);
    assert.doesNotMatch(maxed.reply.aiResponse, /\?/);
  });
});
