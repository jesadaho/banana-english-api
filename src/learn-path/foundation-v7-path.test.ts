import assert from 'node:assert/strict';
import { V7_LEGACY_FLOWS } from '../lessons/foundation-v7-legacy-flows';
import { describe, it } from 'node:test';
import { FOUNDATION_V7_CATALOG, FOUNDATION_V7_NODES, canonicalFoundationV7RewardId, foundationV7NodeTypeCounts, foundationV7RewardAliases, isFoundationV7SimulationId } from './foundation-v7-path.data';
import { isValidNewWordsPack, newWordsPoolById } from '../new-words/new-words.data';
import { hasFoundationV7Content, toFoundationV7ClientChapters } from './foundation-v7-path.view';
import { LearnPathService } from './learn-path.service';
import { LearnPathController } from './learn-path.controller';
import { getLesson, getAllLessons, lessonUsesTapToContinue } from '../lessons/lessons.data';
import { FOUNDATION_V7_LESSONS } from '../lessons/foundation-v7-lessons.data';
import lessonSpecs from '../lessons/foundation-v7-lessons.authoring.json';
import { getSimulation, getAllSimulations, initCheckpointStates, finalizeSimulationTurnState } from '../simulations/simulations.data';
import { FOUNDATION_V7_SIMULATIONS, FOUNDATION_V7_PRESERVED_SIMULATIONS } from '../simulations/foundation-v7-simulations.data';
import { SayItService } from '../say-it/say-it.service';
import { SayItController } from '../say-it/say-it.controller';
import { sayItPoolForTopic, sayItTopicById } from '../say-it/say-it.data';
import { EmojiSpeakService } from '../emoji-speak/emoji-speak.service';
import { MiniGamesController } from '../mini-games/mini-games.controller';
import { EconomyService } from '../economy/economy.service';
import { Currency } from '@prisma/client';

const all = () => toFoundationV7ClientChapters(['say_it_guided']).flatMap(ch => ch.items);
const req = { user: { id: 'v7-test', displayName: 'Mia' } } as any;
const EXPECTED_V7_MIN_TURNS: Record<string, number> = {
  foundation_v7_u02n04: 3,
  foundation_v7_u03n06: 3,
  foundation_v7_u04n06: 4,
  foundation_v7_u06n08: 3,
  foundation_v7_u07n07: 3,
  foundation_v7_u08n10: 3,
  foundation_v7_u09n09: 4,
  foundation_v7_u10n07: 3,
  foundation_v7_u11n06: 3,
  foundation_v7_u12n08: 3,
  foundation_v7_u13n06: 2,
  foundation_v7_u14n15: 3,
  foundation_v7_u14tn21: 2,
  foundation_v7_u15n08: 3,
};

describe('Foundation V7 catalog and real content', () => {
  it('has 16 chapters and the approved 166-node mix after Ch14–16 revamp, without Skill Mix', () => {
    assert.equal(FOUNDATION_V7_CATALOG.chapters.length, 16);
    assert.equal(FOUNDATION_V7_NODES.length, 166);
    assert.equal(new Set(FOUNDATION_V7_NODES.map(n => n.id)).size, 166);
    assert.deepEqual(FOUNDATION_V7_CATALOG.chapters.map(c => c.items.length), [5,5,9,11,11,15,9,6,13,10,9,10,8,11,21,13]);
    assert.deepEqual(FOUNDATION_V7_CATALOG.chapters.slice(13).map(c => c.id), ['v7_u14', 'v7_u14_time_numbers', 'v7_u15']);
    assert.deepEqual(foundationV7NodeTypeCounts(), { lesson:46, say_it:38, emoji_speak:15, new_words:29, pronunciation:4, describe_it:12, story_bites:3, conversation:15, info_task:4 });
    assert.deepEqual(FOUNDATION_V7_NODES.map(n => n.globalOrder), Array.from({length:166}, (_, i) => i + 1));
    for (let i = 1; i < FOUNDATION_V7_NODES.length; i++) {
      const prev = FOUNDATION_V7_NODES[i - 1];
      const next = FOUNDATION_V7_NODES[i];
      if (!['lesson', 'conversation', 'new_words', 'info_task'].includes(prev.type)) assert.notEqual(prev.type, next.type, `${prev.id} repeats ${next.id}`);
    }
  });

  it('ships Thai titles for every chapter and node', () => {
    for (const chapter of FOUNDATION_V7_CATALOG.chapters) {
      assert.ok(chapter.titleTh.trim(), chapter.id);
      assert.notEqual(chapter.titleTh, chapter.titleEn, chapter.id);
    }
    for (const node of FOUNDATION_V7_NODES) {
      assert.ok(node.titleTh.trim(), node.id);
      assert.notEqual(node.titleTh, node.titleEn, node.id);
    }
    const polite = FOUNDATION_V7_NODES.find((node) => node.id === 'v7_u02n02')!;
    assert.equal(polite.titleTh, 'พูดอย่างสุภาพ');
    assert.equal(sayItTopicById(polite.contentRef.topicId!)?.titleTh, 'พูดอย่างสุภาพ');
    assert.equal(
      toFoundationV7ClientChapters()[1].items.find((node) => node.id === 'v7_u02n02')?.titleTh,
      'พูดอย่างสุภาพ',
    );
  });

  it('freezes Chapter 1 canonical content and reuses exactly four original pronunciation lessons', () => {
    assert.deepEqual(FOUNDATION_V7_CATALOG.chapters[0].items.map(n => n.contentRef), [
      {lessonId:'greetings'}, {lessonId:'introductions'}, {topicId:'fnd_v2_first_conversation'},
      {lessonId:'yes_no_maybe'}, {simulationId:'foundation_first_conversation'},
    ]);
    const pron = FOUNDATION_V7_NODES.filter(n => n.type === 'pronunciation');
    assert.deepEqual(pron.map(n => n.contentRef.lessonId), ['pron_final_s_1','pron_th_2','pron_end_t_1','pron_stress_1']);
    const pluralS = FOUNDATION_V7_NODES.find((n) => n.id === 'v7_u05n03')!;
    assert.equal(pluralS.id, 'v7_u05n03');
    assert.equal(pluralS.contentRef.lessonId, 'pron_final_s_1');
    assert.deepEqual(getLesson('pron_final_s_1')?.targetPhrases, ['books', 'bags', 'pens', 'apples']);
    for (const node of pron) {
      assert.equal(node.contentRef.lessonId, node.pronunciation?.sourceLessonId);
      assert.ok(getLesson(node.contentRef.lessonId!));
      assert.ok(hasFoundationV7Content(node));
    }
  });

  it('uses exact IDs, never a similar title to claim content exists', () => {
    const node = FOUNDATION_V7_NODES[0];
    assert.equal(hasFoundationV7Content({...node, contentRef:{lessonId:'does_not_exist'}}), false);
    assert.equal(hasFoundationV7Content({...node, contentRef:{}}), false);
  });

  it('has 159 backend-ready nodes with Describe It packs on, 156 playable by default, and a capability gate for three Guided packs', () => {
    const defaults = toFoundationV7ClientChapters().flatMap(c => c.items);
    assert.equal(defaults.filter(n => n.backendReady).length, 159);
    assert.equal(defaults.filter(n => !n.comingSoon).length, 156);
    assert.equal(all().filter(n => !n.comingSoon).length, 159);
    assert.equal(defaults.filter(n => n.unavailableReason === 'client_capability_required').length, 3);
    assert.equal(defaults.filter(n => n.unavailableReason === 'missing_content').length, 4);
    const placeholders = all().filter(n => n.comingSoon);
    assert.equal(placeholders.length, 7);
    assert.ok(placeholders.every(n => !n.countsTowardProgress));
    assert.equal(
      placeholders.filter(n => n.unavailableReason === 'mechanic_not_implemented').length,
      3,
    );
    assert.equal(
      placeholders.filter(n => n.unavailableReason === 'missing_content').length,
      4,
    );
    for (const id of ['v7_u07n04', 'v7_u08n09', 'v7_u10n04', 'v7_u12n06'] as const) {
      const describeIt = all().find(n => n.id === id);
      assert.equal(describeIt?.comingSoon, true);
      assert.equal(describeIt?.backendReady, false);
    }
    for (const id of ['v7_u03n05', 'v7_u15n04', 'v7_u15n14'] as const) {
      const describeIt = all().find(n => n.id === id);
      assert.equal(describeIt?.comingSoon, false);
      assert.equal(describeIt?.backendReady, true);
      assert.ok(describeIt?.poolId);
    }
    const serialized = JSON.stringify(all());
    assert.equal(serialized.includes('"script"'), false);
    assert.equal(serialized.includes('"questions"'), false);
    assert.equal(serialized.includes('"answer"'), false);
  });

  it('does not make placeholders prerequisites or reorder the legacy hubs', () => {
    for (const capabilities of [[], ['say_it_guided']] as const) {
      let previous: string | undefined;
      for (const node of toFoundationV7ClientChapters(capabilities).flatMap(c => c.items)) {
        assert.deepEqual(node.unlockAfterNodeIds, previous ? [previous] : []);
        if (!node.comingSoon) previous = node.id;
      }
    }
    assert.ok(getAllLessons().every(l => !l.lessonId.startsWith('fnd_v7_')));
    assert.equal(
      getAllSimulations().filter((s) => s.simulationId.startsWith('foundation_v7_')).length,
      FOUNDATION_V7_SIMULATIONS.length + FOUNDATION_V7_PRESERVED_SIMULATIONS.length,
    );
  });

  it('registers authored lesson flows with model, recognition, recall and completion', () => {
    assert.equal(FOUNDATION_V7_LESSONS.length, Object.keys(lessonSpecs).length);
    assert.ok(FOUNDATION_V7_LESSONS.length >= 42);
    for (const [id, spec] of Object.entries(lessonSpecs)) {
      const lesson = getLesson(id)!;
      assert.ok(lesson, id);
      assert.equal(lessonUsesTapToContinue(id), true);
      assert.ok(spec.blocks.length > 0);
      for (const block of spec.blocks) {
        assert.ok(block.models.includes(block.repeat), `${id}: practice must follow its model`);
        for (const target of block.models) assert.ok(lesson.targetPhrases.includes(target));
      }
      assert.ok(lesson.targetPhrases.includes(spec.recall.answerEn));
      if (V7_LEGACY_FLOWS[id]) {
        assert.equal(lesson.progressMax, V7_LEGACY_FLOWS[id].length);
        continue;
      }
      assert.match(lesson.systemInstruction, /Teach block 1/);
      assert.match(lesson.systemInstruction, /Practise block 1/);
      assert.match(lesson.systemInstruction, /Authored choice/);
      assert.match(lesson.systemInstruction, /isLessonComplete=true/);
      assert.match(lesson.openingPrompt, /expectsUserSpeech=false/);
    }
  });

  it('serves all Say It topics through the real service with five unique question IDs', () => {
    const service = new SayItService();
    for (const node of FOUNDATION_V7_NODES.filter(n => n.type === 'say_it')) {
      const id = node.contentRef.topicId!;
      assert.equal(service.getTopic(id).locked, false);
      const result = service.dealForTopic(id, 1, 'Mia');
      const expected = 5;
      assert.equal(result.dealCount, expected, id);
      assert.equal(new Set(result.phrases.map(q => q.id)).size, expected, id);
      for (const q of result.phrases) {
        assert.ok(q.promptTh && q.answerEn && Array.isArray(q.acceptedAnswers));
        assert.doesNotMatch(q.promptTh, /(?:บอกว่า|ถามว่า|พูดว่า|อย่างสุภาพ|ทบทวน:)/, `${id}: Say It should use a direct Thai cue`);
      }
    }
  });

  it('preserves Guided support fading in actual deals', () => {
    const service = new SayItService();
    const guided = FOUNDATION_V7_NODES.filter(n => n.sayItMode === 'guided');
    assert.equal(guided.length, 3);
    for (const node of guided) {
      const pool = sayItPoolForTopic(node.contentRef.topicId!);
      for (let attempt = 0; attempt < 10; attempt++) {
        const result = service.dealForTopic(node.contentRef.topicId!);
        assert.deepEqual(result.phrases.map(q => q.id), pool.map(q => q.id));
        result.phrases.forEach((q, i) => {
          if (i < 3) {
            assert.equal(q.mode, 'guided');
            assert.ok(q.hintEn);
            assert.equal(q.choices?.length, 3);
            assert.equal(q.choices?.filter(c => c === q.answerEn).length, 1);
          } else { assert.equal(q.mode, undefined); assert.equal(q.choices, undefined); }
        });
      }
    }
  });

  it('serves all 17 Emoji pools through the actual deal route service', () => {
    const service = new EmojiSpeakService();
    for (const node of FOUNDATION_V7_NODES.filter(n => n.type === 'emoji_speak')) {
      const deal = service.dealForPool(node.contentRef.poolId!);
      assert.ok(deal.dealCount >= 4 && deal.dealCount <= 10);
      assert.equal(deal.items.length, deal.dealCount);
      for (const q of deal.items) {
        assert.ok(q.emoji && q.answer && q.meaningTh);
        assert.equal(q.promptTh, undefined);
      }
    }
  });

  it('registers authored conversations and closes at the turn cap without inventing completed goals', () => {
    assert.equal(FOUNDATION_V7_SIMULATIONS.length, 14);
    for (const config of FOUNDATION_V7_SIMULATIONS) {
      assert.equal(getSimulation(config.simulationId), config);
      assert.ok(config.foundationMission && config.scenarioTh);
      assert.ok(config.minTurns && config.minTurns >= 2 && config.minTurns < config.maxTurns);
      assert.equal(config.minTurns, EXPECTED_V7_MIN_TURNS[config.simulationId], config.simulationId);
      assert.notEqual(config.completionReplyEn, 'Thanks for talking with me!');
      assert.match(config.systemInstruction, /V2 mission philosophy/);
      assert.match(config.systemInstruction, /concrete outcome/);
      assert.equal(config.successCriteria.length, config.goalsTh.length);
      const checkpoints = initCheckpointStates(config.successCriteria);
      const capped = finalizeSimulationTurnState(config, config.maxTurns, checkpoints, {aiResponse:'And you?', textTh:''});
      assert.equal(capped.isTaskComplete, true);
      assert.deepEqual(capped.checkpoints, checkpoints);
      assert.equal(capped.reply.aiResponse, config.fallbackReplyEn);
      const allGoals = Object.fromEntries(config.successCriteria.map(k => [k,true]));
      const early = finalizeSimulationTurnState(config, config.minTurns! - 1, allGoals, {aiResponse:'And you?',textTh:''});
      assert.equal(early.isTaskComplete, false, `${config.simulationId} closed before minTurns`);
      const passed = finalizeSimulationTurnState(config, config.minTurns!, allGoals, {aiResponse:'And you?',textTh:''});
      assert.equal(passed.reply.aiResponse, config.completionReplyEn);
      assert.equal(passed.isTaskComplete, true);
    }
  });
});

describe('Foundation V7 progress and completion contracts', () => {
  function pathService(completedLessons: string[] = [], miniIds: string[] = [], simulations: string[] = [], skipped: string[][] = []) {
    return new LearnPathService({
      economyTransaction: {findMany: async () => miniIds.map(id => ({referenceId:`mini_game:${id}`}))},
      userSession: {findMany: async () => simulations.map(simulationId => ({simulationId}))},
      foundationChapterSkip: {
        findMany: async () => skipped.map((skippedNodeIds) => ({skippedNodeIds})),
      },
    } as any, {getCompletedLessonIds: async () => new Set(completedLessons)} as any, {} as any);
  }

  it('has exactly one current node and recognizes existing Chapter 1 completion IDs', async () => {
    const initial = await pathService().getFoundationV7('user');
    assert.equal(initial.progress.currentNodeId, 'v7_u01n01');
    const progressed = await pathService(['greetings','introductions','yes_no_maybe'], ['fnd_v2_say_first_conversation'], ['foundation_first_conversation']).getFoundationV7('user');
    assert.equal(progressed.progress.completedCount, 5);
    assert.equal(progressed.progress.currentNodeId, 'v7_u02n01');
  });

  it('recognizes canonical progress and ignores completion claims for Coming Soon content', async () => {
    const playable = all().filter(n => !n.comingSoon);
    const lessons = playable.flatMap(n => n.lessonId ? [n.lessonId] : []);
    const mini = playable.flatMap(n => n.topicId ? [`say_it:${n.topicId}`] : n.nodeType === 'new_words' && n.poolId ? [`new_words:${n.poolId}`] : n.nodeType === 'info_task' && n.poolId ? [`info_task:${n.poolId}`] : n.nodeType === 'describe_it' && n.poolId ? [`describe_it:${n.poolId}`] : n.poolId ? [`emoji_speak:${n.poolId}`] : []);
    const simulations = playable.flatMap(n => n.simulationId ? [n.simulationId] : []);
    mini.push(...all().filter(n => n.comingSoon).map(n => n.id));
    const service = pathService(lessons, mini, simulations);
    const full = await service.getFoundationV7('user', ['say_it_guided']);
    assert.equal(full.progress.completedCount, 159);
    assert.equal(full.progress.totalCount, 159);
    assert.equal(full.progress.currentNodeId, null);
    const legacyClient = await service.getFoundationV7('user');
    assert.equal(legacyClient.progress.completedCount, 156);
    assert.equal(legacyClient.progress.totalCount, 156);
    assert.equal(legacyClient.progress.currentNodeId, null);
  });

  it('rejects unknown capabilities rather than silently enabling unsupported mechanics', async () => {
    const controller = new LearnPathController(pathService());
    assert.equal((await controller.foundationV7(req, 'say_it_guided')).summary.playableCount, 159);
    await assert.rejects(controller.foundationV7(req, 'story_bites'));
    await assert.rejects(controller.foundationV7(req, ['say_it_guided'] as any));
  });

  it('ships New Words demo and catalog pools, and reward aliases', () => {
    const demo = newWordsPoolById('new_words_demo');
    assert.equal(demo?.items.length, 3);
    assert.equal(demo?.items[0].answer, 'apple');
    assert.ok(isValidNewWordsPack(demo));
    assert.equal(canonicalFoundationV7RewardId('new_words_demo'), 'new_words:new_words_demo');
    const catalogNodes = FOUNDATION_V7_NODES.filter(n => n.type === 'new_words');
    assert.equal(catalogNodes.length, 29);
    assert.ok(catalogNodes.some(n => n.contentRef.poolId === 'new_words_what_who'));
    assert.ok(catalogNodes.some(n => n.contentRef.poolId === 'new_words_months_4'));
    assert.ok(!catalogNodes.some(n => n.contentRef.poolId === 'new_words_places_1')); // Around Town off A1
    assert.equal(newWordsPoolById('new_words_people_around_me')?.items.map(i => i.answer).join(','), 'teacher,student,doctor');
    assert.equal(newWordsPoolById('new_words_personal_things')?.items.map(i => i.answer).join(','), 'phone,key,shirt,bag');
    assert.equal(newWordsPoolById('new_words_more_personal_things')?.items.map(i => i.answer).join(','), 'hat,watch,umbrella');
    assert.equal(newWordsPoolById('new_words_food')?.items.map(i => i.answer).join(','), 'rice,noodles,bread');
    assert.equal(newWordsPoolById('new_words_more_feelings')?.items.map(i => i.answer).join(','), 'hot,cold,sick');
    assert.equal(newWordsPoolById('new_words_places_and_fixtures')?.items.map(i => i.answer).join(','), 'door,bed,bathroom');
        for (const node of catalogNodes) {
      const pool = newWordsPoolById(node.contentRef.poolId!);
      assert.ok(isValidNewWordsPack(pool), node.id);
      assert.ok(pool?.items.every((item) => item.emoji && item.answer && item.reading && item.meaningTh), node.id);
      assert.equal(hasFoundationV7Content(node), true);
      assert.equal(canonicalFoundationV7RewardId(node.id), `new_words:${node.contentRef.poolId}`);
    }
    assert.equal(hasFoundationV7Content({
      ...FOUNDATION_V7_NODES[0],
      type: 'new_words',
      contentRef: { poolId: 'new_words_demo' },
    }), true);
  });

  it('allows only actual mini-games and canonicalizes their aliases', () => {
    for (const node of FOUNDATION_V7_NODES) {
      const canonical = canonicalFoundationV7RewardId(node.id);
      if (node.type === 'say_it' || node.type === 'emoji_speak' || node.type === 'new_words' || node.type === 'info_task' || (node.type === 'describe_it' && node.contentRef.poolId)) {
        assert.ok(canonical, node.id);
        assert.equal(canonicalFoundationV7RewardId(node.contentRef.topicId ?? node.contentRef.poolId!), canonical);
        assert.equal(canonicalFoundationV7RewardId(canonical), canonical);
      } else assert.equal(canonical, undefined, node.id);
    }
    assert.equal(canonicalFoundationV7RewardId('fnd_v7_unknown'), undefined);
    assert.ok(foundationV7RewardAliases('v7_u01n03').includes('fnd_v2_say_first_conversation'));
  });

  it('allows V7 Say It completion and keeps Foundation start pricing unchanged', async () => {
    const calls: any[] = [];
    const economy = {applyMiniGameRewards: async (p: any) => {calls.push(p); return p;}, recordMiniGameScore: async () => {}, spendBananas: async () => {throw new Error('Say It Foundation start should remain free');}};
    const controller = new SayItController(new SayItService(), economy as any, {markActivity: async () => {}} as any);
    for (const node of FOUNDATION_V7_NODES.filter(n => n.type === 'say_it')) {
      assert.equal((await controller.startTopic(req, node.contentRef.topicId!)).bananaCost, 0);
      const reward = await controller.completeTopic(req, node.contentRef.topicId!);
      assert.equal((reward as any).gameId, `say_it:${node.contentRef.topicId}`);
    }
    assert.equal(calls.length, 38);
    await assert.rejects(controller.completeTopic(req, 'fnd_v7_unknown'));
  });

  it('accepts mini-game completion IDs but rejects lesson and unbuilt media IDs', async () => {
    const economy = {applyMiniGameRewards: async (p: any) => p, recordMiniGameScore: async () => {}, spendBananas: async () => {}, hasClaimedMiniGameReward: async () => false};
    const controller = new MiniGamesController(economy as any, {} as any, {} as any, {} as any, {} as any, {markActivity:async () => {}} as any, {} as any, new EmojiSpeakService());
    for (const node of FOUNDATION_V7_NODES) {
      if (['say_it','emoji_speak','new_words','info_task'].includes(node.type) || (node.type === 'describe_it' && node.contentRef.poolId)) await controller.complete(req, node.id);
      else await assert.rejects(controller.complete(req, node.id));
      if (node.type === 'emoji_speak') assert.equal((await controller.startEmojiSpeakPack(req, node.contentRef.poolId!)).bananaCost, 1);
      if (node.type === 'new_words') assert.equal((await controller.startNewWordsPack(req, node.contentRef.poolId!)).bananaCost, 1);
    }
  });

  it('uses one reward reference across raw topic, prefixed ID and node ID; honors old Chapter 1 rewards', async () => {
    const rows: any[] = [];
    let user: any = {id:'v7-test',timezone:'Asia/Bangkok',bananaBalance:5,xpBalance:0,bananaSeedBalance:0,streakDays:0,longestStreakDays:0,lastSessionDate:null,streakMilestonesClaimed:[]};
    const tx = {
      economyTransaction: {
        findFirst: async ({where}: any) => rows.find(r => r.userId === where.userId && r.currency === where.currency && r.source === where.source && where.referenceId.in.includes(r.referenceId)),
        create: async ({data}: any) => {rows.push(data); return data;},
      },
      user: {
        findUniqueOrThrow: async () => user,
        update: async ({data}: any) => { for (const [key,value] of Object.entries(data)) user[key] = value && typeof value === 'object' && 'increment' in value ? (user[key] ?? 0) + (value as any).increment : value; return user; },
      },
    };
    const service = new EconomyService({$transaction:async (fn: any) => fn(tx)} as any, {get: () => undefined} as any);
    const node = FOUNDATION_V7_NODES.find(n => n.type === 'say_it' && n.id.startsWith('v7_u02'))!;
    const first = await service.applyMiniGameRewards({userId:user.id,gameId:node.id});
    assert.equal(first.xpEarned, 20);
    for (const gameId of [node.contentRef.topicId!, `say_it:${node.contentRef.topicId}`]) {
      const repeat = await service.applyMiniGameRewards({userId:user.id,gameId});
      assert.equal(repeat.alreadyClaimed, true);
      assert.equal(repeat.xpEarned, 0);
    }
    assert.equal(rows.filter(r => r.currency === Currency.XP).length, 1);
    assert.equal(rows[0].referenceId, `mini_game:say_it:${node.contentRef.topicId}`);
    rows.push({userId:user.id,currency:Currency.XP,source:'mini_game_reward',referenceId:'mini_game:fnd_v2_say_first_conversation'});
    const frozen = await service.applyMiniGameRewards({userId:user.id,gameId:'v7_u01n03'});
    assert.equal(frozen.alreadyClaimed, true);
    assert.equal(frozen.xpEarned, 0);
  });

  it('treats V7 conversation simulations as path missions, not Adventure series', () => {
    const conversations = FOUNDATION_V7_NODES.filter((n) => n.type === 'conversation');
    assert.equal(conversations.length, 15);
    for (const node of conversations) {
      const id = node.contentRef.simulationId!;
      assert.ok(getSimulation(id), id);
      assert.equal(isFoundationV7SimulationId(id), true, id);
    }
    assert.equal(isFoundationV7SimulationId('coffee_order_easy'), false);
    assert.equal(isFoundationV7SimulationId('foundation_v7_unknown'), false);
  });
});
