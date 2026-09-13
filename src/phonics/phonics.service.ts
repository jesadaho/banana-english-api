import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import authoringJson from './phonics-course.authoring.json';
import type { CheckPhonicsNodeDto } from './dto/check-phonics-node.dto';
import { PrismaService } from '../prisma/prisma.service';
import { buildClearEnglishCourse } from './clear-english-course.data';
import { isPhonicsLesson } from './phonics-lessons.data';

type JsonRecord = Record<string, unknown>;

type AuthoringSpec = JsonRecord & {
  scoredDenominator: number;
  passThreshold: number;
  items: JsonRecord[];
};

type CourseNode = JsonRecord & {
  id: string;
  title: string;
  prereqs: string[];
  assessmentMode: string;
};

type CourseChapter = JsonRecord & {
  chapter: number;
  title: string;
  nodes: CourseNode[];
};

type AuthoringCatalog = {
  version: string;
  course: JsonRecord;
  chapters: CourseChapter[];
  runtimeTruth: JsonRecord;
  runtime: {
    shared: JsonRecord;
    deliveryContract: JsonRecord;
    oralMeaningPreExposureWithoutPrint: {
      policy: string;
      entries: Array<{
        preExposureRef: string;
        assetId: string;
        audioAssetId: string;
      }>;
    };
    specs: Record<string, AuthoringSpec>;
  };
};

const catalog = authoringJson as AuthoringCatalog;

const PHONICS_NODE_IDS = new Set(
  catalog.chapters.flatMap((chapter) => chapter.nodes.map((node) => node.id)),
);

/** Designer JSON used 1/2/8; learner course continues after the 5 legacy chapters. */
function learnerChapterNumber(authoringChapter: number): number {
  if (authoringChapter === 1) return 6;
  if (authoringChapter === 2) return 7;
  return authoringChapter;
}

export function isPhonicsNodeId(nodeId: string): boolean {
  return PHONICS_NODE_IDS.has(nodeId);
}

export type PhonicsProgressRow = {
  attemptCount: number;
  passed: boolean;
};

/** Test double for server-owned retry / pass state. */
export class MemoryPhonicsProgressStore {
  private readonly rows = new Map<string, PhonicsProgressRow>();

  async recordCheck(
    userId: string,
    nodeId: string,
    passed: boolean,
  ): Promise<PhonicsProgressRow> {
    const key = `${userId}:${nodeId}`;
    const prev = this.rows.get(key) ?? { attemptCount: 0, passed: false };
    const next = {
      attemptCount: prev.attemptCount + 1,
      passed: prev.passed || passed,
    };
    this.rows.set(key, next);
    return next;
  }

  async hasPassed(userId: string, nodeId: string): Promise<boolean> {
    return this.rows.get(`${userId}:${nodeId}`)?.passed ?? false;
  }

  async passedNodeIds(userId: string): Promise<string[]> {
    const prefix = `${userId}:`;
    const ids: string[] = [];
    for (const [key, row] of this.rows) {
      if (row.passed && key.startsWith(prefix)) {
        ids.push(key.slice(prefix.length));
      }
    }
    return ids;
  }
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index]))
    );
  }
  if (
    left != null &&
    right != null &&
    typeof left === 'object' &&
    typeof right === 'object'
  ) {
    const a = left as JsonRecord;
    const b = right as JsonRecord;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

/** Never expose answer keys, transcripts, or diagnostic pattern labels. */
function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value == null || typeof value !== 'object') return value;

  const output: JsonRecord = {};
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    if (key.startsWith('authoring')) continue;
    if (key === 'spokenText' || key === 'transcript') continue;
    if (key === 'correct' || key.startsWith('correct')) continue;
    output[key] = sanitize(child);
  }
  return output;
}

function expectedAnswer(item: JsonRecord): unknown {
  return item.authoringAnswerKey ?? item.correct;
}

@Injectable()
export class PhonicsService {
  private readonly nodes = catalog.chapters.flatMap((chapter) => chapter.nodes);
  private readonly nodeById = new Map(this.nodes.map((node) => [node.id, node]));

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly memoryStore?: MemoryPhonicsProgressStore,
  ) {}

  async getCourse(userId?: string) {
    const rows = userId ? await this.prisma.userSession.findMany({
      where:{userId, sessionType:'training', lessonId:{not:null}, rewardsApplied:true},
      select:{lessonId:true}, distinct:['lessonId'],
    }) : [];
    return buildClearEnglishCourse(new Set(rows.flatMap(row => row.lessonId ? [row.lessonId] : [])));
  }

  /** Retained explicitly for clients of the retired 18-node quiz preview. */
  async getLegacyCourse(userId?: string) {
    const passedIds = userId
      ? new Set(await this.passedNodeIds(userId))
      : new Set<string>();

    return {
      courseId: 'clear_english_phonics',
      version: catalog.version,
      status: 'preview',
      chapterCount: catalog.chapters.length,
      nodeCount: this.nodes.length,
      chapters: catalog.chapters.map((chapter) => ({
        chapter: learnerChapterNumber(chapter.chapter),
        title: chapter.title,
        goal: chapter.goal,
        arc: chapter.arc,
        nodes: chapter.nodes.map((node) => ({
          id: node.id,
          title: node.title,
          type: node.type,
          goal: node.goal,
          mechanic: node.mechanic,
          prereqs: node.prereqs,
          assessmentMode: node.assessmentMode,
          estimatedMinutes: node.estimatedMinutes ?? null,
          passed: passedIds.has(node.id),
        })),
      })),
    };
  }

  getNode(nodeId: string) {
    if (isPhonicsLesson(nodeId)) {
      throw new BadRequestException('This is a training lesson. Use POST /sessions with sessionType=training and lessonId; not the legacy phonics quiz API.');
    }
    const node = this.nodeById.get(nodeId);
    const spec = catalog.runtime.specs[nodeId];
    if (!node || !spec) throw new NotFoundException(`Phonics node not found: ${nodeId}`);

    const refs = new Set(
      spec.items
        .map((item) => item.preExposureRef)
        .filter((ref): ref is string => typeof ref === 'string'),
    );
    const preExposure =
      catalog.runtime.oralMeaningPreExposureWithoutPrint.entries
        .filter((entry) => refs.has(entry.preExposureRef))
        .map((entry) => ({
          preExposureRef: entry.preExposureRef,
          assetId: entry.assetId,
          audioAssetId: entry.audioAssetId,
          learnerVisibleText: null,
        }));

    return {
      node: sanitize(node),
      activity: sanitize({
        scoredDenominator: spec.scoredDenominator,
        passThreshold: spec.passThreshold,
        replayLimit: catalog.runtime.shared.replayLimit,
        retryLimit: catalog.runtime.shared.retryLimit,
        items: spec.items,
      }),
      preExposure,
      scoringNotice:
        'Deterministic choices/builds are scored. Optional speaking is participation only.',
    };
  }

  async checkNode(userId: string, dto: CheckPhonicsNodeDto) {
    const node = this.nodeById.get(dto.nodeId);
    const spec = catalog.runtime.specs[dto.nodeId];
    if (!node || !spec) throw new NotFoundException(`Phonics node not found: ${dto.nodeId}`);

    const seen = new Set<number>();
    const scored = dto.answers.map(({ itemIndex, answer }) => {
      if (seen.has(itemIndex)) {
        throw new BadRequestException(`Duplicate itemIndex: ${itemIndex}`);
      }
      seen.add(itemIndex);
      const item = spec.items[itemIndex];
      if (!item) throw new BadRequestException(`Invalid itemIndex: ${itemIndex}`);
      const expected = expectedAnswer(item);
      if (expected === undefined) {
        throw new BadRequestException(`Item ${itemIndex} has no deterministic answer`);
      }
      return {
        itemIndex,
        correct: deepEqual(answer, expected),
        expected,
      };
    });

    const correctCount = scored.filter((result) => result.correct).length;
    const completeSubmission = seen.size === spec.scoredDenominator;
    const passed = completeSubmission && correctCount >= spec.passThreshold;
    const progress = await this.recordCheck(userId, dto.nodeId, passed);
    const reveal = progress.attemptCount >= 2;

    return {
      nodeId: dto.nodeId,
      attemptNumber: progress.attemptCount,
      correctCount,
      scoredDenominator: spec.scoredDenominator,
      passThreshold: spec.passThreshold,
      completeSubmission,
      passed,
      speakingScored: false,
      results: scored.map(({ itemIndex, correct, expected }) => ({
        itemIndex,
        correct,
        ...(correct || !reveal ? {} : { revealedAnswer: expected }),
      })),
    };
  }

  async hasPassed(userId: string, nodeId: string): Promise<boolean> {
    if (this.memoryStore) {
      return this.memoryStore.hasPassed(userId, nodeId);
    }
    const row = await this.prisma.phonicsNodeProgress.findUnique({
      where: { userId_nodeId: { userId, nodeId } },
      select: { passed: true },
    });
    return row?.passed ?? false;
  }

  async assertPassed(userId: string, nodeId: string): Promise<void> {
    if (!(await this.hasPassed(userId, nodeId))) {
      throw new ForbiddenException(`Pass ${nodeId} before claiming rewards`);
    }
  }

  private async passedNodeIds(userId: string): Promise<string[]> {
    if (this.memoryStore) {
      return this.memoryStore.passedNodeIds(userId);
    }
    const rows = await this.prisma.phonicsNodeProgress.findMany({
      where: { userId, passed: true },
      select: { nodeId: true },
    });
    return rows.map((row) => row.nodeId);
  }

  private async recordCheck(
    userId: string,
    nodeId: string,
    passed: boolean,
  ): Promise<PhonicsProgressRow> {
    if (this.memoryStore) {
      return this.memoryStore.recordCheck(userId, nodeId, passed);
    }
    return this.prisma.phonicsNodeProgress.upsert({
      where: { userId_nodeId: { userId, nodeId } },
      create: { userId, nodeId, attemptCount: 1, passed },
      update: {
        attemptCount: { increment: 1 },
        ...(passed ? { passed: true } : {}),
      },
    });
  }
}
