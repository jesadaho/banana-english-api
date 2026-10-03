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
import { ADVENTURE_A2_LESSONS, buildFoundationV7Steps } from '../lessons/foundation-v7-lessons.data';
import { getLesson } from '../lessons/lessons.data';
import { getSimulation } from '../simulations/simulations.data';
import { getInteractiveScenario } from '../interactive-scenario/interactive-scenario.data';
import { emojiSpeakPoolById } from '../emoji-speak/emoji-speak.data';
import { isValidNewWordsPack, newWordsPoolById } from '../new-words/new-words.data';
import { sayItTopicById } from '../say-it/say-it.data';
import { SayItService } from '../say-it/say-it.service';
import { hearItPoolById } from '../hear-it/hear-it.data';
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

describe('Adventure A2 course registry', () => {
  it('registers as a second course with a2_ ids that never collide with Foundation V7', () => {
    assert.equal(ADVENTURE_A2_COURSE.pathId, ADVENTURE_A2_PATH_ID);
    assert.equal(learnCourseById('adventure-a2'), ADVENTURE_A2_COURSE);
    assert.equal(learnCourseById('adventure_a2'), ADVENTURE_A2_COURSE);
    assert.equal(learnCourseById('foundation-v7'), FOUNDATION_V7_COURSE);
    assert.equal(learnCourseById('adventure-a3'), undefined);
    assert.equal(a2Nodes.length, 333);
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
      .filter((n) => !AWAITING_ART.has(n.type) && !hasFoundationV7Content(n))
      .map((n) => `${n.code} ${n.type}`);
    assert.deepEqual(missing, []);
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
        case 'emoji_speak': assert.ok((emojiSpeakPoolById(id)?.items.length ?? 0) >= 5, id); break;
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
    assert.ok(ADVENTURE_A2_LESSONS.length >= 18);
    for (const lesson of ADVENTURE_A2_LESSONS) {
      const steps = buildFoundationV7Steps(lesson.lessonId);
      assert.equal(steps[0].kind, 'welcome', lesson.lessonId);
      assert.equal(steps.at(-1)!.kind, 'complete', lesson.lessonId);
      assert.equal(steps.filter((s) => s.kind === 'choice').length, 1, lesson.lessonId);
      for (const step of steps.filter((s) => s.expectsUserSpeech)) {
        assert.ok(step.expectedSpeech?.trim(), `${lesson.lessonId} ${step.kind} needs expectedSpeech`);
      }
      assert.equal(lesson.difficulty, 'intermediate');
      assert.match(lesson.systemInstruction, /Adventure A2/);
    }
  });

  it('gives every conversation three goals', () => {
    for (const node of zone1.filter((n) => n.type === 'conversation')) {
      const sim = getSimulation(node.id)!;
      assert.equal(sim.successCriteria.length, 3, node.id);
    }
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
});
