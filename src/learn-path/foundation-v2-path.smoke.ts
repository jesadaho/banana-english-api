/**
 * Referential integrity for foundation-v2 path nodes.
 * Playable (not comingSoon) nodes must resolve to real content.
 *
 *   npx ts-node src/learn-path/foundation-v2-path.smoke.ts
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  FOUNDATION_V2_CHAPTERS,
  flattenFoundationV2Nodes,
  foundationV2CoreTotal,
  isFoundationPathRewardGameId,
  type FoundationV2NodeDef,
} from './foundation-v2-path.data';
import { isFoundationChoiceLesson } from '../training/scripts/foundation.registry';
import {
  personalizeSayItPhrase,
  sayItPoolForTopic,
  sayItTopicById,
} from '../say-it/say-it.data';
import { getSimulation } from '../simulations/simulations.data';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const nodes = flattenFoundationV2Nodes();
assert(nodes.length === 54, `expected 54 nodes, got ${nodes.length}`);
assert(
  foundationV2CoreTotal() === 51,
  `expected 51 core, got ${foundationV2CoreTotal()}`,
);
assert(
  nodes.filter((n) => !n.countsTowardProgress).length === 3,
  'expected 3 optional nodes',
);

const ch1 = FOUNDATION_V2_CHAPTERS[0];
assert(ch1.items.length === 5, 'ch1 should have 5 nodes');
assert(
  ch1.items.every((n) => n.comingSoon !== true),
  'ch1 must be fully playable',
);
assert(ch1.items[0].id === 'greetings', 'preserve greetings id');
assert(ch1.items[1].id === 'introductions', 'preserve introductions id');
assert(ch1.items[2].id === 'fnd_v2_say_first_conversation', 'say it node');
assert(ch1.items[2].topicId === 'fnd_v2_first_conversation', 'say it topic');
assert(
  JSON.stringify(
    sayItPoolForTopic('fnd_v2_first_conversation').map((phrase) => phrase.id),
  ) === JSON.stringify([
    'fnd_hello',
    'fnd_my_name_is_user',
    'fnd_nice_to_meet_you',
    'fnd_im_from_thailand',
    'fnd_i_live_in_bangkok',
  ]),
  'first conversation must only retrieve five phrases taught before this node',
);
assert(
  !sayItPoolForTopic('fnd_v2_first_conversation')
    .find((phrase) => phrase.id === 'fnd_im_from_thailand')
    ?.acceptedAnswers.includes("I'm from Thai"),
  'Thailand card must not accept the incorrect country name "Thai"',
);
const personalizedNameCard = personalizeSayItPhrase(
  sayItPoolForTopic('fnd_v2_first_conversation').find(
    (phrase) => phrase.id === 'fnd_my_name_is_user',
  )!,
  'Mali',
);
assert(personalizedNameCard.promptTh === 'ฉันชื่อ Mali', 'name prompt must use learner name');
assert(personalizedNameCard.answerEn === 'My name is Mali.', 'name answer must use learner name');
assert(
  personalizedNameCard.acceptedAnswers.includes("I'm Mali"),
  'personalized short answer must be accepted',
);
const politePool = sayItPoolForTopic('fnd_v2_be_polite');
assert(
  JSON.stringify(politePool.map((phrase) => phrase.id)) ===
    JSON.stringify([
      'fnd_please',
      'fnd_thank_you',
      'fnd_youre_welcome',
      'fnd_excuse_me',
      'fnd_sorry',
    ]),
  'be polite must only retrieve its five taught expressions',
);
assert(
  politePool.find((phrase) => phrase.id === 'fnd_please')?.promptTh === 'ได้โปรด',
  'Please prompt must be concise',
);
assert(
  politePool.find((phrase) => phrase.id === 'fnd_excuse_me')?.subtitleTh ===
    'ใช้เรียกใครอย่างสุภาพ',
  'Excuse me must explain its context without revealing English',
);
assert(ch1.items[3].id === 'yes_no_maybe', 'preserve yes_no_maybe id');
assert(ch1.items[4].id === 'fnd_v2_mission_meet_max', 'meet max mission');
assert(
  ch1.items[4].simulationId === 'meet_new_friend_easy',
  'meet max uses existing simulation',
);

const ch4 = FOUNDATION_V2_CHAPTERS[3];
assert(ch4.items[0].id === 'numbers', 'numbers 0–10 keeps numbers id');
assert(ch4.items[0].titleEn === 'Numbers 0–10', 'numbers retitled 0–10');
assert(
  ch4.items[1].id === 'fnd_v2_numbers_11_20',
  'split numbers 11–20 lesson',
);
assert(ch4.items[1].comingSoon !== true, 'numbers 11–20 must be playable');

const optionalIds = new Set(
  nodes.filter((n) => !n.countsTowardProgress).map((n) => n.id),
);
for (const n of nodes) {
  if (!n.countsTowardProgress) continue;
  for (const pre of n.unlockAfterNodeIds) {
    assert(
      !optionalIds.has(pre),
      `core node ${n.id} must not unlock after optional ${pre}`,
    );
  }
}

// Soft-lock check: playable core must not unlockAfter comingSoon core.
const byId = new Map(nodes.map((n) => [n.id, n]));
for (const n of nodes) {
  if (n.comingSoon || !n.countsTowardProgress) continue;
  for (const pre of n.unlockAfterNodeIds) {
    const p = byId.get(pre);
    assert(
      !(p?.comingSoon && p.countsTowardProgress),
      `playable ${n.id} soft-locked by comingSoon ${pre}`,
    );
  }
}

function assertPlayableContent(node: FoundationV2NodeDef) {
  if (node.comingSoon) return;
  switch (node.type) {
    case 'lesson':
      assert(
        isFoundationChoiceLesson(node.id),
        `playable lesson missing board/registry: ${node.id}`,
      );
      break;
    case 'say_it': {
      const topicId = node.topicId ?? '';
      assert(!!sayItTopicById(topicId), `missing say-it topic: ${topicId}`);
      assert(
        sayItPoolForTopic(topicId).length > 0,
        `empty say-it pool: ${topicId}`,
      );
      assert(
        isFoundationPathRewardGameId(`say_it:${topicId}`),
        `say_it reward id not in catalog: ${topicId}`,
      );
      break;
    }
    case 'mission': {
      const simId = node.simulationId ?? '';
      assert(!!getSimulation(simId), `missing simulation: ${simId}`);
      break;
    }
    case 'emoji_speak': {
      const poolId = node.poolId ?? '';
      assert(!!poolId, `emoji_speak ${node.id} missing poolId`);
      assert(
        isFoundationPathRewardGameId(`emoji_speak:${poolId}`),
        `emoji pool not rewardable: ${poolId}`,
      );
      break;
    }
    case 'review':
    case 'describe_it':
    case 'number_challenge':
      throw new Error(
        `${node.type} ${node.id} is playable but has no content yet — mark comingSoon`,
      );
    default:
      break;
  }
}

for (const node of nodes) {
  assertPlayableContent(node);
}

// Reward allowlist must not accept invented IDs.
assert(
  !isFoundationPathRewardGameId('fnd_v2_totally_fake_node'),
  'fake fnd_v2 id must not be rewardable',
);
assert(
  isFoundationPathRewardGameId('say_it:fnd_v2_first_conversation'),
  'first conversation say_it must be rewardable',
);

// Pool JSON file exists for generated pools.
const poolsPath = join(__dirname, '../say-it/say-it-pools.generated.json');
assert(existsSync(poolsPath), 'say-it-pools.generated.json missing');

console.log('foundation-v2 smoke OK', {
  total: nodes.length,
  core: foundationV2CoreTotal(),
  chapters: FOUNDATION_V2_CHAPTERS.length,
  playable: nodes.filter((n) => !n.comingSoon).length,
  comingSoon: nodes.filter((n) => n.comingSoon).length,
});
