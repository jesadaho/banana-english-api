import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PHONICS_LESSONS, PHONICS_LESSON_SPECS, isPhonicsLesson } from './phonics-lessons.data';
import { buildClearEnglishCourse, CLEAR_ENGLISH_LESSON_IDS } from './clear-english-course.data';
import { getLesson, getAllLessons, isPronunciationLesson, lessonUsesTapToContinue, normalizeEmojiChoice, LESSON_PROGRESSION_ORDER } from '../lessons/lessons.data';
import { LessonsService } from '../lessons/lessons.service';
import { MemoryPhonicsProgressStore, PhonicsService, isPhonicsNodeId } from './phonics.service';
import { PhonicsController } from './phonics.controller';

describe('Phonics v2 — ordinary speaking lessons', () => {
  it('exposes exactly 7 chapters, 54 lessons, with 20 new and 34 unchanged IDs', () => {
    const course = buildClearEnglishCourse();
    assert.equal(course.chapterCount,7);
    assert.equal(course.nodeCount,54);
    assert.deepEqual(course.chapters.map(ch => ch.nodes.length),[10,10,8,8,6,6,6]);
    assert.equal(new Set(CLEAR_ENGLISH_LESSON_IDS).size,54);
    assert.equal(course.chapters.flatMap(ch => ch.nodes).filter(n => n.legacy).length,34);
    assert.equal(course.chapters[4].previousTitle,'Fine-tune Your Sounds');
    assert.equal(course.chapters[5].previousTitle,'Stress & Rhythm');
    assert.equal(course.chapters[6].previousTitle,'Speak Smoothly');
    const oldIds = getAllLessons().filter(l => l.lessonId.startsWith('pron_')).map(l => l.lessonId);
    assert.equal(oldIds.length,34);
    assert.deepEqual(course.chapters.slice(2).flatMap(ch => ch.nodes.map(n => n.id)).sort(),oldIds.sort());
    for (const chapter of course.chapters) for (const node of chapter.nodes) {
      assert.equal(node.type,'lesson');
      assert.equal(node.lessonId,node.id);
      assert.equal(node.sessionType,'training');
      assert.deepEqual(node.startRequest,{sessionType:'training',lessonId:node.id});
      assert.equal(node.title,getLesson(node.id)?.titleEn);
      assert.deepEqual(node.prereqs,[]);
    }
  });

  it('registers new content for the existing training session, without changing legacy hub ordering', async () => {
    assert.equal(PHONICS_LESSONS.length,20);
    const lessons = new LessonsService({} as any,{} as any);
    for (const lesson of PHONICS_LESSONS) {
      assert.equal(getLesson(lesson.lessonId),lesson);
      assert.equal(isPhonicsLesson(lesson.lessonId),true);
      assert.equal(isPronunciationLesson(lesson.lessonId),true);
      assert.equal(lessonUsesTapToContinue(lesson.lessonId),true);
      assert.equal(await lessons.isLessonUnlockedForUser('user',lesson.lessonId),true);
      assert.equal(getAllLessons().some(l => l.lessonId === lesson.lessonId),false);
      assert.equal(lesson.coachOnly,true);
      assert.equal(lesson.listenOnlyTurns,2);
      assert.ok(lesson.progressMax! < lesson.maxTurns);
    }
    assert.equal(isPhonicsLesson('pron_phonics_unknown'),false);
  });

  it('includes phonics completions on lesson progress without adding them to the hub', async () => {
    const completedId = 'pron_phonics_01_first_code';
    const lessons = new LessonsService({
      userSession: {
        findMany: async () => [{ lessonId: completedId }],
        findFirst: async () => ({ lessonId: completedId }),
      },
    } as any, {} as any);
    const view = await lessons.buildProgressView('user');
    const phonics = view.lessons.find(row => row.lessonId === completedId);
    assert.ok(phonics);
    assert.equal(phonics!.status, 'completed');
    assert.equal(LESSON_PROGRESSION_ORDER.includes(completedId), false);
    assert.equal(getAllLessons().some(row => row.lessonId === completedId), false);
    assert.equal(view.lessons.filter(row => row.lessonId.startsWith('pron_phonics_')).length, 20);
  });

  it('uses the real emojiChoice contract for letters/patterns and taught whole-word speech targets', () => {
    for (const spec of PHONICS_LESSON_SPECS) {
      const board = {options:spec.choices.map(c => ({emoji:c.symbol,label:c.word,speak:c.word}))};
      assert.deepEqual(normalizeEmojiChoice(board),board);
      for (const choice of spec.choices) assert.ok(spec.models.includes(choice.word),`${spec.lessonId}: ${choice.word} not modeled`);
      assert.ok(!spec.models.includes(spec.transfer),`${spec.lessonId} reveals transfer in model set`);
      assert.ok(!spec.choices.some(c => c.word === spec.transfer));
      const lesson = getLesson(spec.lessonId)!;
      assert.ok(lesson.targetPhrases.includes(spec.transfer));
      assert.ok(lesson.targetPhrases.includes(spec.phrase));
      assert.match(lesson.systemInstruction,/Try first:/);
      assert.ok(lesson.systemInstruction.indexOf('Try first:') < lesson.systemInstruction.indexOf('Reveal:'));
      assert.match(lesson.systemInstruction,/MUST NOT contain the target/);
      assert.match(lesson.systemInstruction,/No sorting, tile building, timed quiz/);
      assert.match(lesson.systemInstruction,/NOT acoustic evidence/);
      assert.match(lesson.systemInstruction,/Isolated sounds.*require reviewed recordings/);
      assert.match(lesson.openingPrompt,/expectsUserSpeech=false/);
    }
  });

  it('introduces all basic consonant and short-vowel codes before pattern lessons', () => {
    const basic = new Set(PHONICS_LESSON_SPECS.filter(s => s.chapter === 1).flatMap(s => s.introducedCodes));
    for (const letter of 'abcdefghijklmnoprstuvwyz') assert.ok(basic.has(letter),letter);
    assert.ok(basic.has('x') && basic.has('qu'));
    assert.deepEqual(PHONICS_LESSON_SPECS.slice(10).map(s => s.introducedCodes),[
      ['sh'],['ch'],['th_unvoiced','th_voiced'],['ng','nk'],['a_e'],['i_e'],['o_e'],['ee','ea'],['ai','ay'],['oa'],
    ]);
    const lesson8 = PHONICS_LESSON_SPECS[8];
    assert.match(lesson8.tipTh,/สองเสียง/);
    assert.match(PHONICS_LESSON_SPECS[13].tipTh,/ng.*เสียงเดียว.*nk.*k/);
    assert.match(PHONICS_LESSON_SPECS[17].tipTh,/ea.*อาจเปลี่ยนเสียง/);
  });

  it('tracks actual completed training sessions, not old quiz pass state; filters unrelated progress', async () => {
    let query: any;
    const firstNew = PHONICS_LESSONS[0].lessonId;
    const store = new MemoryPhonicsProgressStore();
    await store.recordCheck('user','phon_code_1',true);
    const service = new PhonicsService({userSession:{findMany:async (args: any) => {
      query=args; return [{lessonId:'pron_th_1'},{lessonId:firstNew},{lessonId:'greetings'},{lessonId:null}];
    }}} as any,store);
    const course = await new PhonicsController(service).getCourse({user:{id:'user'}} as any);
    assert.equal(query.where.userId,'user');
    assert.equal(query.where.rewardsApplied,true);
    assert.equal(query.where.sessionType,'training');
    assert.equal(course.progress.completedCount,2);
    assert.equal(course.progress.totalCount,54);
    assert.equal(course.progress.currentNodeId,PHONICS_LESSONS[1].lessonId);
    assert.ok(course.chapters[2].nodes[0].completed);
    assert.ok(!course.progress.completedNodeIds.includes('phon_code_1'));
    assert.ok(!course.progress.completedNodeIds.includes('greetings'));
    assert.equal(buildClearEnglishCourse(new Set(CLEAR_ENGLISH_LESSON_IDS)).progress.currentNodeId,null);
  });

  it('retains the old preview explicitly, without letting new lessons claim mini-game rewards', async () => {
    const service = new PhonicsService({} as any,new MemoryPhonicsProgressStore());
    const old = await service.getLegacyCourse();
    assert.equal(old.nodeCount,18);
    assert.equal((await service.getCourse()).nodeCount,54);
    for (const lesson of PHONICS_LESSONS) {
      assert.equal(isPhonicsNodeId(lesson.lessonId),false);
      assert.throws(() => service.getNode(lesson.lessonId),/training lesson/);
      await assert.rejects(service.checkNode('user',{nodeId:lesson.lessonId,answers:[]}));
    }
    assert.equal(isPhonicsNodeId('phon_code_1'),true);
  });
});
