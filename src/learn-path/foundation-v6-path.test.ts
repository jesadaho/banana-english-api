import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FOUNDATION_V6_CATALOG,
  FOUNDATION_V6_CONTENT_REFS,
  flattenFoundationV6Nodes,
  foundationV6NodeTypeCounts,
} from './foundation-v6-path.data';
import { sayItPoolForTopic, sayItTopicById } from '../say-it/say-it.data';
import { toFoundationV6ClientChapters } from './learn-path.service';
import { FOUNDATION_V6_LESSON_IDS } from '../lessons/foundation-v6-lessons.data';
import { getLesson, LESSON_PROGRESSION_ORDER } from '../lessons/lessons.data';

describe('Foundation V6 catalog', () => {
  it('exposes the lighter 16-chapter, 95-node playtest path', () => {
    const nodes = flattenFoundationV6Nodes();
    assert.equal(FOUNDATION_V6_CATALOG.chapters.length, 16);
    assert.equal(nodes.length, 95);
    assert.deepEqual(
      FOUNDATION_V6_CATALOG.chapters.map((chapter) => chapter.items.length),
      [5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    );
    assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length);
    assert.deepEqual(
      nodes.map((node) => node.globalOrder),
      Array.from({ length: 95 }, (_, index) => index + 1),
    );
  });

  it('keeps chapter 1 frozen and uses the approved node mix', () => {
    assert.deepEqual(
      FOUNDATION_V6_CATALOG.chapters[0].items.map((node) => [node.titleEn, node.type]),
      [
        ['Greetings', 'lesson'],
        ['Introductions', 'lesson'],
        ['First Conversation', 'say_it'],
        ['Yes / No / Maybe', 'lesson'],
        ['Meet Max', 'conversation'],
      ],
    );
    assert.deepEqual(foundationV6NodeTypeCounts(), {
      lesson: 31,
      say_it: 18,
      emoji_speak: 6,
      pronunciation: 9,
      story_bites: 8,
      sentence_builder: 0,
      describe_it: 6,
      conversation: 17,
    });
  });

  it('reuses pronunciation skills and keeps Story Bites unavailable', () => {
    const nodes = flattenFoundationV6Nodes();
    assert.ok(
      nodes
        .filter((node) => node.type === 'pronunciation')
        .every(
          (node) =>
            node.pronunciation?.mode === 'contextual_reuse' &&
            node.pronunciation.sourceSkillIds.length > 0,
        ),
    );
    assert.equal(nodes.some((node) => node.type === ('skill_mix' as string)), false);
    assert.ok(
      nodes
        .filter((node) => node.type === 'story_bites')
        .every((node) => node.comingSoon),
    );
  });

  it('connects every Say It and Emoji Speak node to an existing-engine pool', () => {
    const nodes = flattenFoundationV6Nodes();
    const sayItNodes = nodes.filter((node) => node.type === 'say_it');
    const emojiNodes = nodes.filter((node) => node.type === 'emoji_speak');

    assert.equal(sayItNodes.length, 18);
    assert.equal(emojiNodes.length, 6);
    for (const node of sayItNodes) {
      const topicId = FOUNDATION_V6_CONTENT_REFS[node.id]?.topicId;
      assert.ok(topicId, `${node.titleEn} is missing topicId`);
      assert.ok(sayItTopicById(topicId), `${topicId} is missing topic metadata`);
      assert.equal(sayItPoolForTopic(topicId).length, 5, `${topicId} must have five questions`);
    }
    for (const node of emojiNodes) {
      assert.ok(
        FOUNDATION_V6_CONTENT_REFS[node.id]?.poolId,
        `${node.titleEn} is missing poolId`,
      );
    }
  });

  it('marks every V6 Say It and Emoji Speak node playable', () => {
    const nodes = toFoundationV6ClientChapters().flatMap((chapter) => chapter.items);
    const speechGames = nodes.filter(
      (node) => node.nodeType === 'say_it' || node.nodeType === 'emoji_speak',
    );
    assert.equal(speechGames.length, 24);
    assert.ok(speechGames.every((node) => !node.comingSoon));
  });

  it('gives every Guided Say It node five scaffolded questions', () => {
    const guidedNodes = flattenFoundationV6Nodes().filter(
      (node) => node.sayItMode === 'guided',
    );
    assert.equal(guidedNodes.length, 9);
    for (const node of guidedNodes) {
      const topicId = FOUNDATION_V6_CONTENT_REFS[node.id]?.topicId;
      assert.ok(topicId);
      const pool = sayItPoolForTopic(topicId);
      assert.equal(pool.length, 5);
      assert.ok(
        pool.every(
          (question) =>
            question.mode === 'guided' &&
            Boolean(question.hintEn) &&
            question.choices?.length === 3,
        ),
      );
    }
  });

  it('ships all 31 lesson nodes with independent lesson content', () => {
    const lessons = toFoundationV6ClientChapters()
      .flatMap((chapter) => chapter.items)
      .filter((node) => node.nodeType === 'lesson');
    assert.equal(lessons.length, 31);
    assert.ok(lessons.every((node) => !node.comingSoon && node.lessonId));
    assert.ok(lessons.every((node) => getLesson(node.lessonId!) != null));
    assert.equal(new Set(lessons.map((node) => node.lessonId)).size, 31);
    assert.ok(
      FOUNDATION_V6_LESSON_IDS.every((id) => !LESSON_PROGRESSION_ORDER.includes(id)),
      'V6-only lessons must stay off the shipped lesson progression',
    );
    assert.equal(LESSON_PROGRESSION_ORDER[0], 'greetings');
  });

  it('ships all 9 pronunciation nodes with independent coach content', () => {
    const pronunciation = toFoundationV6ClientChapters()
      .flatMap((chapter) => chapter.items)
      .filter((node) => node.nodeType === 'pronunciation');
    assert.equal(pronunciation.length, 9);
    assert.ok(pronunciation.every((node) => !node.comingSoon && node.lessonId));
    assert.ok(pronunciation.every((node) => getLesson(node.lessonId!) != null));
    assert.equal(new Set(pronunciation.map((node) => node.lessonId)).size, 9);
    assert.ok(
      pronunciation.every((node) =>
        node.lessonId!.startsWith('fnd_v6_pron_'),
      ),
      'V6 pronunciation nodes must not share completion with another course',
    );
    assert.ok(
      pronunciation.every(
        (node) => !LESSON_PROGRESSION_ORDER.includes(node.lessonId!),
      ),
      'V6 contextual pronunciation must stay off standalone lesson progression',
    );
  });
});
