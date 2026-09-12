import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FOUNDATION_V5_CATALOG,
  flattenFoundationV5Nodes,
  foundationV5NodeTypeCounts,
} from './foundation-v5-path.data';

describe('Foundation V5 catalog', () => {
  it('exposes the approved R6 chapter and node structure', () => {
    const nodes = flattenFoundationV5Nodes();
    assert.equal(FOUNDATION_V5_CATALOG.chapters.length, 16);
    assert.equal(nodes.length, 109);
    assert.deepEqual(
      FOUNDATION_V5_CATALOG.chapters.map((chapter) => chapter.items.length),
      [5, 6, 7, 6, 7, 7, 6, 7, 7, 7, 7, 8, 7, 7, 7, 8],
    );
    assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length);
    assert.deepEqual(
      nodes.map((node) => node.globalOrder),
      Array.from({ length: 109 }, (_, index) => index + 1),
    );
  });

  it('supports Skill Check and keeps Story Bites coming soon', () => {
    const nodes = flattenFoundationV5Nodes();
    const storyBites = nodes.filter((node) => node.type === 'story_bites');
    const skillChecks = nodes.filter((node) => node.type === 'skill_check');

    assert.equal(foundationV5NodeTypeCounts().story_bites, 8);
    assert.equal(foundationV5NodeTypeCounts().skill_check, 10);
    assert.ok(skillChecks.length > 0);
    assert.ok(
      storyBites.every(
        (node) => node.comingSoon && node.availability === 'coming_soon',
      ),
    );
    assert.ok(
      nodes
        .filter((node) => node.type !== 'story_bites')
        .every((node) => !node.comingSoon),
    );
  });

  it('preserves the frozen Chapter 1 sequence', () => {
    assert.deepEqual(
      FOUNDATION_V5_CATALOG.chapters[0].items.map((node) => [
        node.titleEn,
        node.type,
      ]),
      [
        ['Greetings', 'lesson'],
        ['Introductions', 'lesson'],
        ['First Conversation', 'say_it'],
        ['Yes / No / Maybe', 'lesson'],
        ['Meet Max', 'conversation'],
      ],
    );
  });
});
