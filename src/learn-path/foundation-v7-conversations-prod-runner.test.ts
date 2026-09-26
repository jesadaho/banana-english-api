import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALL_V7_PATH_CONVERSATION_IDS,
  AUTHORED_V7_CONVERSATION_IDS,
  FROZEN_V7_CONVERSATION_IDS,
  happyLinesFor,
  parseFoundationV7ConversationArgs,
} from '../../scripts/lib/foundation-v7-conversations-prod-runner.ts';
import { FOUNDATION_V7_NODES } from './foundation-v7-path.data';
import { FOUNDATION_V7_SIMULATIONS } from '../simulations/foundation-v7-simulations.data';
import { getSimulation } from '../simulations/simulations.data';

describe('Foundation V7 conversation smoke runner', () => {
  it('covers every path conversation, including frozen Meet Max', () => {
    const pathIds = FOUNDATION_V7_NODES.filter((n) => n.type === 'conversation')
      .map((n) => n.contentRef.simulationId)
      .filter((id): id is string => Boolean(id));
    assert.deepEqual(ALL_V7_PATH_CONVERSATION_IDS, pathIds);
    assert.deepEqual(FROZEN_V7_CONVERSATION_IDS, [
      'foundation_first_conversation',
    ]);
    assert.deepEqual(
      AUTHORED_V7_CONVERSATION_IDS.filter(
        (id) =>
          id !== 'foundation_v7_u16n10' && id !== 'foundation_v7_u14n06',
      ),
      FOUNDATION_V7_SIMULATIONS.map((s) => s.simulationId),
    );
    assert.equal(AUTHORED_V7_CONVERSATION_IDS.length, 16);
    assert.equal(FOUNDATION_V7_SIMULATIONS.length, 14);
    assert.equal(ALL_V7_PATH_CONVERSATION_IDS.length, 15);
    assert.ok(
      AUTHORED_V7_CONVERSATION_IDS.includes('foundation_v7_u16n10'),
      'Around Town preserved in authoring',
    );
    assert.ok(
      AUTHORED_V7_CONVERSATION_IDS.includes('foundation_v7_u14n06'),
      'Plan My Class preserved in authoring',
    );
    assert.ok(
      !ALL_V7_PATH_CONVERSATION_IDS.includes('foundation_v7_u16n10'),
      'Around Town not on A1 path',
    );
    assert.ok(
      !ALL_V7_PATH_CONVERSATION_IDS.includes('foundation_v7_u14n06'),
      'Plan My Class not on A1 path',
    );
    assert.ok(getSimulation('foundation_v7_u16n10'));
    assert.ok(getSimulation('foundation_v7_u14n06'));
  });

  it('scripts a happy path matching each authored minTurns', () => {
    for (const config of FOUNDATION_V7_SIMULATIONS) {
      assert.equal(
        happyLinesFor(config.simulationId).length,
        config.minTurns,
        config.simulationId,
      );
    }
  });

  it('keeps Chapters 1–6 NPC-led without requiring learner questions', () => {
    const earlyMissionIds = [
      'foundation_first_conversation',
      'foundation_v7_u02n04',
      'foundation_v7_u03n06',
      'foundation_v7_u04n06',
      'foundation_v7_u06n08',
    ];

    for (const simulationId of earlyMissionIds) {
      assert.equal(
        happyLinesFor(simulationId).some((line) => line.includes('?')),
        false,
        `${simulationId} should let the NPC ask while the learner responds`,
      );
    }
  });

  it('parses authored by default, chapters, node ids and optional scenarios', () => {
    assert.deepEqual(parseFoundationV7ConversationArgs(['node', 'script']), {
      simulationIds: [...AUTHORED_V7_CONVERSATION_IDS],
      scenarios: [1],
    });
    assert.deepEqual(
      parseFoundationV7ConversationArgs(['node', 'script', 'frozen']),
      {
        simulationIds: ['foundation_first_conversation'],
        scenarios: [1],
      },
    );
    assert.deepEqual(
      parseFoundationV7ConversationArgs(['node', 'script', 'ch2']),
      {
        simulationIds: ['foundation_v7_u02n04'],
        scenarios: [1],
      },
    );
    assert.deepEqual(
      parseFoundationV7ConversationArgs([
        'node',
        'script',
        'v7_u02n04',
        '2',
      ]),
      {
        simulationIds: ['foundation_v7_u02n04'],
        scenarios: [2],
      },
    );
    assert.deepEqual(
      parseFoundationV7ConversationArgs(['node', 'script', 'u16', '3']),
      {
        simulationIds: ['foundation_v7_u16n10'],
        scenarios: [3],
      },
    );
    assert.throws(
      () => parseFoundationV7ConversationArgs(['node', 'script', 'unknown']),
      /unknown V7 conversation/,
    );
  });
});
