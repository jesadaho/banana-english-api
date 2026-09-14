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
      AUTHORED_V7_CONVERSATION_IDS,
      FOUNDATION_V7_SIMULATIONS.map((s) => s.simulationId),
    );
    assert.equal(AUTHORED_V7_CONVERSATION_IDS.length, 15);
    assert.equal(ALL_V7_PATH_CONVERSATION_IDS.length, 16);
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
        simulationIds: ['foundation_v7_u16n05'],
        scenarios: [3],
      },
    );
    assert.throws(
      () => parseFoundationV7ConversationArgs(['node', 'script', 'unknown']),
      /unknown V7 conversation/,
    );
  });
});
