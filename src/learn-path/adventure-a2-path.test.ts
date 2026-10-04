import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';
import {
  ADVENTURE_A2_COURSE,
  ADVENTURE_A2_PATH_ID,
  ALL_LEARN_PATH_NODES,
  FOUNDATION_V7_CAPABILITIES,
  FOUNDATION_V7_COURSE,
  canonicalFoundationV7RewardId,
  learnCourseById,
  learnCourseForChapter,
  learnCourseForNodeId,
} from './foundation-v7-path.data';
import { hasFoundationV7Content, toFoundationV7ClientChapters } from './foundation-v7-path.view';
import { LearnPathController } from './learn-path.controller';
import { LearnPathService } from './learn-path.service';
import { ADVENTURE_A2_LESSONS, buildFoundationV7Steps, foundationV7LessonSpec } from '../lessons/foundation-v7-lessons.data';
import { getLesson } from '../lessons/lessons.data';
import { TrainingTurnEngine } from '../training/engine/training-turn.engine';
import type { TrainingAiGate } from '../training/engine/ai-gate';
import type { ChatTurn } from '../session-store/session-store.service';
import { finalizeSimulationTurnState, getSimulation } from '../simulations/simulations.data';
import { getInteractiveScenario } from '../interactive-scenario/interactive-scenario.data';
import { emojiSpeakPoolById } from '../emoji-speak/emoji-speak.data';
import { isValidNewWordsPack, newWordsPoolById } from '../new-words/new-words.data';
import { sayItTopicById } from '../say-it/say-it.data';
import { SayItService } from '../say-it/say-it.service';
import { HEAR_IT_ENABLED, hearItPoolById } from '../hear-it/hear-it.data';
import { storyBitesPoolById } from '../story-bites/story-bites.data';
import { describeItPoolById } from '../describe-it/describe-it.data';
import { initScenarioRuntime, localMatchCurrentBeat, processScenarioTurn } from '../interactive-scenario/interactive-scenario.runtime';

const ZONE_1_CHAPTERS = 8;
const A2_CAPABILITIES = [...FOUNDATION_V7_CAPABILITIES];
const a2Nodes = ADVENTURE_A2_COURSE.nodes;
const chapterOf = (code: string) => Number(code.split('.')[0]);
const zone1 = a2Nodes.filter((n) => chapterOf(n.code) <= ZONE_1_CHAPTERS);
/** Picture packs ship only once their bundled images exist (seeAndSayImagesReady). */
const AWAITING_ART = new Set(['describe_it', 'explain_it']);
/** Owner-written flows exempt from the generated-flow shape contract. */
const HAND_AUTHORED_FLOWS = new Set(['a2_c01n02', 'a2_c01n04']);

describe('Adventure A2 course registry', () => {
  it('registers as a second course with a2_ ids that never collide with Foundation V7', () => {
    assert.equal(ADVENTURE_A2_COURSE.pathId, ADVENTURE_A2_PATH_ID);
    assert.equal(learnCourseById('adventure-a2'), ADVENTURE_A2_COURSE);
    assert.equal(learnCourseById('adventure_a2'), ADVENTURE_A2_COURSE);
    assert.equal(learnCourseById('foundation-v7'), FOUNDATION_V7_COURSE);
    assert.equal(learnCourseById('adventure-a3'), undefined);
    assert.equal(a2Nodes.length, 328);
    assert.equal(ADVENTURE_A2_COURSE.catalog.chapters.length, 32);
    assert.equal(new Set(ALL_LEARN_PATH_NODES.map((n) => n.id)).size, ALL_LEARN_PATH_NODES.length);
    for (const node of a2Nodes) {
      assert.match(node.id, /^a2_c\d{2}n\d{2}$/);
      const ref = Object.values(node.contentRef);
      assert.ok(ref.every((id) => id === node.id), `${node.id} contentRef must equal node id`);
      assert.equal(learnCourseForNodeId(node.id), ADVENTURE_A2_COURSE);
    }
    assert.equal(learnCourseForChapter('a2_c01'), ADVENTURE_A2_COURSE);
    assert.equal(learnCourseForChapter('v7_u01'), FOUNDATION_V7_COURSE);
  });

  it('releases only Zone 1 (chapters 1–8)', () => {
    assert.equal(ADVENTURE_A2_COURSE.catalog.metadata.releasedChapterCount, ZONE_1_CHAPTERS);
    const chapters = toFoundationV7ClientChapters(A2_CAPABILITIES, ADVENTURE_A2_COURSE);
    for (const chapter of chapters.slice(ZONE_1_CHAPTERS)) {
      for (const item of chapter.items) {
        assert.equal(item.comingSoon, true, item.id);
        assert.equal(item.countsTowardProgress, false, item.id);
      }
    }
    assert.equal(chapters[0].zone, 1);
    assert.equal(chapters[8].zone, 2);
  });
});

describe('Adventure A2 Zone 1 content', () => {
  it('has real content behind every Zone 1 node except pending picture packs', () => {
    const missing = zone1
      .filter((n) => !AWAITING_ART.has(n.type) && !(n.type === 'hear_it' && !HEAR_IT_ENABLED))
      .filter((n) => !hasFoundationV7Content(n))
      .map((n) => `${n.code} ${n.type}`);
    assert.deepEqual(missing, []);
  });

  it('keeps Hear It nodes coming soon while Hear It is off', { skip: HEAR_IT_ENABLED }, () => {
    const items = toFoundationV7ClientChapters(A2_CAPABILITIES, ADVENTURE_A2_COURSE)
      .flatMap((c) => c.items)
      .filter((i) => i.nodeType === 'hear_it');
    assert.ok(items.length > 0);
    assert.ok(items.every((i) => i.comingSoon && !i.poolId));
  });

  it('opens playable Zone 1 nodes in a linear chain', () => {
    const items = toFoundationV7ClientChapters(A2_CAPABILITIES, ADVENTURE_A2_COURSE)
      .slice(0, ZONE_1_CHAPTERS)
      .flatMap((c) => c.items);
    const playable = items.filter((i) => !i.comingSoon);
    assert.ok(playable.length >= 70, `only ${playable.length} playable`);
    assert.deepEqual(playable[0].unlockAfterNodeIds, []);
    for (let i = 1; i < playable.length; i++) {
      assert.deepEqual(playable[i].unlockAfterNodeIds, [playable[i - 1].id]);
    }
    for (const item of items.filter((i) => i.nodeType === 'describe_it' && i.comingSoon)) {
      assert.equal(item.poolId, undefined, `${item.id} must not leak a pool before its art ships`);
    }
  });

  it('wires every content type through its existing lookup', () => {
    for (const node of zone1) {
      const id = node.id;
      switch (node.type) {
        case 'new_words': assert.ok(isValidNewWordsPack(newWordsPoolById(id)), id); break;
        case 'emoji_speak': assert.ok((emojiSpeakPoolById(id)?.items.length ?? 0) >= 4, id); break;
        case 'say_it': assert.ok(sayItTopicById(id), id); break;
        case 'hear_it': assert.ok(hearItPoolById(id), id); break;
        case 'story_bites': assert.equal(storyBitesPoolById(id)?.questions.length, 3, id); break;
        case 'lesson':
        case 'pronunciation': assert.ok(getLesson(id), id); break;
        case 'conversation': assert.ok(getSimulation(id), id); break;
        case 'interactive_scenario': assert.ok(getInteractiveScenario(id), id); break;
        case 'describe_it': assert.equal(describeItPoolById(id), undefined, `${id} has no art yet`); break;
      }
    }
  });

  it('keeps A2 Say It topics out of the Games hub and gives every item two hints', () => {
    const hub = new SayItService().listTopics().map((t) => t.id);
    assert.ok(!hub.some((id) => id.startsWith('a2_')));
    for (const node of zone1.filter((n) => n.type === 'emoji_speak')) {
      for (const item of emojiSpeakPoolById(node.id)!.items) {
        assert.equal(item.hints?.length, 2, `${node.id} ${item.answer}`);
        assert.doesNotMatch(item.hint, /_{2,} _/, 'letter hints keep word gaps');
      }
    }
  });

  it('builds authored lesson flows that respect the V7 step contract', () => {
    assert.ok(ADVENTURE_A2_LESSONS.length >= 71);
    for (const lesson of ADVENTURE_A2_LESSONS) {
      const steps = buildFoundationV7Steps(lesson.lessonId);
      const isFlow = Boolean(foundationV7LessonSpec(lesson.lessonId)?.flow);
      assert.equal(steps.at(-1)!.kind, 'complete', lesson.lessonId);
      if (HAND_AUTHORED_FLOWS.has(lesson.lessonId)) {
        assert.ok(isFlow, lesson.lessonId);
      } else if (isFlow) {
        const checks = steps.filter((s) => s.presentation?.answerMode === 'single' && s.presentation.options.length);
        assert.ok(checks.length >= 2, `${lesson.lessonId} needs two recognition checks`);
        assert.ok(steps.some((s) => s.expectsUserSpeech && !s.presentation?.options.length && !s.skippable),
          `${lesson.lessonId} needs a hidden recall step`);
      } else {
        assert.equal(steps[0].kind, 'welcome', lesson.lessonId);
        assert.equal(steps.filter((s) => s.kind === 'choice').length, 1, lesson.lessonId);
      }
      for (const step of steps.filter((s) => s.expectsUserSpeech)) {
        assert.ok(step.expectedSpeech?.trim(), `${lesson.lessonId} ${step.kind} needs expectedSpeech`);
      }
      assert.equal(lesson.difficulty, 'intermediate');
      assert.match(lesson.systemInstruction, /Adventure A2/);
    }
  });

  it('plays every lesson through the server runtime with its model answers', async () => {
    const engine = new TrainingTurnEngine({} as unknown as TrainingAiGate);
    for (const lesson of ADVENTURE_A2_LESSONS) {
      let reply = engine.buildOpening(lesson, 'Nana').reply;
      const turns: ChatTurn[] = [{ speaker: 'ai', ...reply }];
      for (let guard = 0; !reply.isLessonComplete; guard++) {
        assert.ok(guard < 40, `${lesson.lessonId} never completes`);
        const userText = reply.expectsUserSpeech ? reply.expectedSpeech! : 'continue';
        turns.push({ speaker: 'user', textEn: userText });
        reply = (await engine.runTurn({
          config: lesson, turns, userText, originalText: userText,
          learnerFirstName: 'Nana', sessionProgressTurn: reply.v7Step,
        })).reply;
        assert.ok(!reply.v7Retry, `${lesson.lessonId} rejected "${userText}"`);
        turns.push({ speaker: 'ai', ...reply });
      }
    }
  });

  it('lets learners skip repeat-after-me turns but never question turns', async () => {
    const engine = new TrainingTurnEngine({} as unknown as TrainingAiGate);
    for (const lesson of ADVENTURE_A2_LESSONS) {
      const steps = buildFoundationV7Steps(lesson.lessonId);
      let reply = engine.buildOpening(lesson, 'Nana').reply;
      const turns: ChatTurn[] = [{ speaker: 'ai', ...reply }];
      for (let guard = 0; !reply.isLessonComplete; guard++) {
        assert.ok(guard < 60, `${lesson.lessonId} never completes`);
        const step = steps[reply.v7Step! - 1];
        const isRepeat = step.kind === 'model_repeat' || step.kind === 'repeat' || step.skippable === true;
        assert.equal(!!reply.canSkip, isRepeat && reply.expectsUserSpeech, `${lesson.lessonId} ${step.kind}`);
        const send = async (userText: string) => {
          turns.push({ speaker: 'user', textEn: userText });
          const next = (await engine.runTurn({
            config: lesson, turns, userText, originalText: userText,
            learnerFirstName: 'Nana', sessionProgressTurn: reply.v7Step,
          })).reply;
          turns.push({ speaker: 'ai', ...next });
          return next;
        };
        if (!reply.expectsUserSpeech) {
          reply = await send('continue');
        } else if (reply.canSkip) {
          const next = await send('(tapped Skip)');
          assert.equal(next.v7Step, reply.v7Step! + 1, `${lesson.lessonId} skip should advance`);
          reply = next;
        } else {
          const stay = await send('(tapped Skip)');
          assert.equal(stay.v7Step, reply.v7Step, `${lesson.lessonId} ${step.kind} must not skip`);
          reply = await send(reply.expectedSpeech!);
        }
      }
    }
  });

  it('gives every conversation three or four goals', () => {
    for (const node of zone1.filter((n) => n.type === 'conversation')) {
      const sim = getSimulation(node.id)!;
      assert.ok([3, 4].includes(sim.successCriteria.length), node.id);
    }
  });

  it('lets New Friends close with the AI recap of real answers', () => {
    const sim = getSimulation('a2_c01n10')!;
    assert.equal(sim.aiClosing, true);
    assert.deepEqual(sim.successCriteria, ['intro', 'hobby', 'ask_back', 'dislike']);
    assert.equal(sim.goalHints?.[2]?.intentTh, 'ลองถามกลับว่าครูชอบทำอะไร');
    assert.equal(sim.goalHints?.[3]?.intentTh, 'คุณไม่ชอบทำอะไร?');
    const done = Object.fromEntries(sim.successCriteria.map((k) => [k, true]));
    const recap = finalizeSimulationTurnState(sim, 4, done, {
      aiResponse: "You enjoy gaming and you don't like baking. Welcome to the club, Ploy!",
      textTh: 'คุณสนุกกับการเล่นเกมและไม่ชอบอบขนม ยินดีต้อนรับสู่ชมรมนะ Ploy!',
    });
    assert.equal(recap.isTaskComplete, true);
    assert.match(recap.reply.aiResponse, /^You enjoy gaming/);
    const asking = finalizeSimulationTurnState(sim, 4, done, {
      aiResponse: 'What else do you like?', textTh: 'ชอบอะไรอีก?',
    });
    assert.equal(asking.reply.aiResponse, sim.completionReplyEn);
  });

  it('runs Checkpoint 1 as three resumable scenes with one goal per beat', () => {
    const scenario = getInteractiveScenario('a2_c08n09')!;
    assert.equal(scenario.scenes.length, 3);
    assert.equal(scenario.beats.length, 12);
    for (const scene of scenario.scenes) {
      const beats = scenario.beats.filter((b) => b.sceneId === scene.id);
      assert.equal(beats.length, 4, scene.id);
      const asks = beats.filter((b) => b.learnerMayAsk || /\bask\b|price/.test(b.focusGoalIds.join(' ')));
      assert.ok(asks.length >= 1, `${scene.id} needs a learner question`);
    }
    const goalIds = new Set(scenario.goals.map((g) => g.id));
    const used = scenario.beats.flatMap((b) => b.focusGoalIds);
    assert.equal(new Set(used).size, used.length, 'each goal is focused by exactly one beat');
    for (const id of used) assert.ok(goalIds.has(id), id);

    const model = (beatIndex: number) => {
      const beat = scenario.beats[beatIndex];
      return scenario.goals.find((g) => g.id === beat.focusGoalIds[0])!.hints.modelEn;
    };
    let state = initScenarioRuntime(scenario);
    for (let i = 0; i < scenario.beats.length; i++) {
      assert.ok(localMatchCurrentBeat(scenario, state, model(i)), `${scenario.beats[i].id} accepts its model`);
      const result = processScenarioTurn({ scenario, state, transcript: model(i) });
      assert.doesNotMatch(result.reply.aiResponse, /Canada|John/, 'May and Bee never answer as Teacher John');
      state = result.state;
    }
    assert.equal(state.finished, true);
  });
});

describe('Adventure A2 endpoint', () => {
  it('serves the A2 course with its own pathId and level', async () => {
    const service = new LearnPathService({
      economyTransaction: { findMany: async () => [] },
      userSession: { findMany: async () => [] },
      foundationChapterSkip: { findMany: async () => [] },
    } as any, { getCompletedLessonIds: async () => new Set<string>() } as any, {} as any);
    const controller = new LearnPathController(service);
    const res = await controller.coursePath({ user: { id: 'a2-test' } } as any, 'adventure-a2', A2_CAPABILITIES.join(','));
    assert.equal(res.pathId, ADVENTURE_A2_PATH_ID);
    assert.equal(res.level, 'A2');
    assert.equal(res.chapters.length, 32);
    assert.equal(res.progress.currentNodeId, 'a2_c01n01');
  });

  it('keys A2 rewards by the a2_ content id', () => {
    for (const node of zone1) {
      const canonical = canonicalFoundationV7RewardId(node.id);
      if (canonical) assert.ok(canonical.endsWith(`:${node.id}`), `${node.id} -> ${canonical}`);
    }
  });
});

describe('Adventure A2 generator', () => {
  it('generated JSON is up to date with the course spec and overlays', () => {
    execFileSync('python3', ['scripts/build-learn-course.py', '--check'], { stdio: 'pipe' });
  });

  it('passes the course QA script', () => {
    const out = execFileSync('python3', ['scripts/a2/qa.py'], { encoding: 'utf8' });
    assert.match(out, /ERRORS: 0/);
  });

  it('plays the hand-written I Enjoy Baking flow', async () => {
    const engine = new TrainingTurnEngine({} as unknown as TrainingAiGate);
    const config = { ...getLesson('a2_c01n02')!, lessonId: 'a2_c01n02' };
    const turns: ChatTurn[] = [];
    const say = async (text: string) => {
      turns.push({ speaker: 'user', textEn: text } as ChatTurn);
      const { reply } = await engine.runTurn({
        config, turns, userText: text, originalText: text, learnerFirstName: 'Nana',
      });
      turns.push({ speaker: 'ai', ...reply } as ChatTurn);
      return reply;
    };
    const intro = engine.buildOpening(config, 'Nana').reply;
    turns.push({ speaker: 'ai', ...intro } as ChatTurn);
    assert.equal(intro.expectsUserSpeech, false);
    assert.match(intro.textEn, /bake → baking/);
    const repeat = await say('(tapped Continue)');
    assert.equal(repeat.canSkip, true);
    const gaming = await say('I enjoy baking.');
    assert.equal(gaming.guidedSpeaking?.options.length, 2);
    const hiking = await say('I enjoy gaming.');
    assert.match(hiking.textEn, /^ดีครับ I enjoy gaming\. แปลว่า/);
    assert.equal(hiking.expectedSpeech, 'I enjoy hiking.');
    assert.equal(hiking.guidedSpeaking?.options.length, 4);
    const likeLove = await say('I enjoy hiking.');
    assert.equal(likeLove.expectsUserSpeech, false);
    const pickVerb = await say('(tapped Continue)');
    assert.equal(pickVerb.expectedSpeech, 'I love gaming.');
    const dont = await say('I love gaming.');
    assert.match(dont.textEn, /^ถูกต้องครับ I love gaming\./);
    assert.equal(dont.expectedSpeech, "I don't like gaming.");
    assert.equal(dont.canSkip, true);
    const dontPick = await say("I don't like gaming.");
    assert.equal(dontPick.expectedSpeech, "I don't like cycling.");
    const pick = await say("I don't like cycling.");
    assert.match(pick.textEn, /^I don’t like cycling\. แปลว่า/);
    assert.equal(pick.guidedSpeaking?.options.length, 4);
    const closing = await say("I don't like baking.");
    assert.equal(closing.isLessonComplete, true);
    assert.equal(closing.assessmentTier, 'correct');
    assert.match(closing.textEn, /^I don't like baking\. แปลว่า “ฉันไม่ชอบอบขนม” ครับ\nครูบีรู้จักคุณมากขึ้นแล้ว!/);
  });

  it('plays the hand-written What Do You Like Doing? flow', async () => {
    const engine = new TrainingTurnEngine({} as unknown as TrainingAiGate);
    const config = { ...getLesson('a2_c01n04')!, lessonId: 'a2_c01n04' };
    const turns: ChatTurn[] = [];
    const say = async (text: string) => {
      turns.push({ speaker: 'user', textEn: text } as ChatTurn);
      const { reply } = await engine.runTurn({
        config, turns, userText: text, originalText: text, learnerFirstName: 'Nana',
      });
      turns.push({ speaker: 'ai', ...reply } as ChatTurn);
      return reply;
    };
    const intro = engine.buildOpening(config, 'Nana').reply;
    turns.push({ speaker: 'ai', ...intro } as ChatTurn);
    assert.equal(intro.expectsUserSpeech, false);
    const ask = await say('(tapped Continue)');
    assert.equal(ask.expectedSpeech, 'What do you like doing?');
    assert.equal(ask.canSkip, true);
    const answer = await say('What do you like doing?');
    assert.equal(answer.expectsUserSpeech, false);
    assert.match(answer.textEn, /How about you\?/);
    const mine = await say('(tapped Continue)');
    assert.equal(mine.guidedSpeaking?.options.length, 4);
    const askBack = await say('I like baking.');
    assert.match(askBack.textEn, /^I like baking\. แปลว่า “ฉันชอบอบขนม” ครับ\nลองอีกสถานการณ์/);
    assert.deepEqual(askBack.guidedSpeaking?.options.map((o) => o.speak), ['How about you?', 'Thank you.']);
    const meTooIntro = await say('How about you?');
    assert.match(meTooIntro.textEn, /^How about you\? แปลว่า/);
    const meToo = await say('(tapped Continue)');
    assert.equal(meToo.expectedSpeech, 'Me too!');
    assert.equal(meToo.canSkip, undefined);
    const last = await say('Me too!');
    assert.match(last.textEn, /^ใช่เลยครับ!\nรอบสุดท้าย/);
    assert.equal(last.canSkip, undefined);
    const closing = await say('What do you like doing?');
    assert.equal(closing.isLessonComplete, true);
    assert.match(closing.textEn, /^What do you like doing\? แปลว่า “คุณชอบทำอะไร” ครับ\nครูบีตอบว่า I enjoy hiking\./);
  });
});
