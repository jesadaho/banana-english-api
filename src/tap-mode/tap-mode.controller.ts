import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { buildTapChoices } from './tap-choices';
import { tapDistractorWords, type TapContext } from './tap-vocab';

type TapItemBody = { id?: unknown; answer?: unknown; accepted?: unknown; options?: unknown };

const MAX_ITEMS = 40;

/** Node kinds that offer Tap Mode (analytics buckets). */
export const ANSWER_MODE_KINDS = ['lesson', 'say_it', 'word_cards', 'see_and_say', 'new_words', 'in_on_at'] as const;
export const ANSWER_MODES = ['speak', 'tap'] as const;


function strings(value: unknown, max = 12): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && !!v.trim()).slice(0, max).map((v) => v.slice(0, 200))
    : [];
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : undefined;
}

/**
 * Tap Mode word chips. The app sends what it is about to ask (a lesson turn's
 * expected sentence, or a whole Say It deal) and gets chips per item:
 * `POST /tap-mode/choices { lessonId?|topicId?|poolId?, items: [{ id, answer, accepted?, options? }] }`
 * → `{ items: { [id]: string[] } }`.
 */
@Controller('tap-mode')
@UseGuards(AnonymousUserGuard)
export class TapModeController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One answer on a Tap-Mode-capable node, spoken or tapped:
   * `{ kind: lesson|say_it|word_cards|see_and_say|new_words, mode: speak|tap, correct }`.
   * Counted per UTC day for admin (Speak vs Tap). Fire-and-forget from the app.
   */
  @Post('answer')
  async answer(
    @Req() req: { user: User },
    @Body() body: { kind?: unknown; mode?: unknown; correct?: unknown },
  ) {
    const kind = (ANSWER_MODE_KINDS as readonly string[]).includes(String(body?.kind))
      ? String(body.kind)
      : null;
    const mode = (ANSWER_MODES as readonly string[]).includes(String(body?.mode))
      ? String(body.mode)
      : null;
    if (!kind || !mode) throw new BadRequestException('bad_kind_or_mode');
    const correct = body.correct === true ? 1 : 0;
    const now = new Date();
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    await this.prisma.answerModeDaily.upsert({
      where: { day_userId_kind_mode: { day, userId: req.user.id, kind, mode } },
      create: { day, userId: req.user.id, kind, mode, count: 1, correct },
      update: { count: { increment: 1 }, correct: { increment: correct } },
    });
    return { ok: true };
  }

  @Post('choices')
  choices(
    @Body()
    body: { lessonId?: unknown; topicId?: unknown; poolId?: unknown; items?: unknown },
  ) {
    const items = Array.isArray(body?.items) ? (body.items as TapItemBody[]).slice(0, MAX_ITEMS) : [];
    if (!items.length) throw new BadRequestException('items required');
    const ctx: TapContext = {
      lessonId: str(body.lessonId),
      topicId: str(body.topicId),
      poolId: str(body.poolId),
    };
    const distractors = tapDistractorWords(ctx);
    const out: Record<string, string[]> = {};
    items.forEach((item, i) => {
      const answer = typeof item?.answer === 'string' ? item.answer.trim().slice(0, 200) : '';
      if (!answer) return;
      const id = str(item.id) ?? String(i);
      out[id] = buildTapChoices({
        answer,
        accepted: strings(item.accepted),
        options: strings(item.options, 6),
        distractorWords: distractors,
        seed: `${ctx.lessonId ?? ctx.topicId ?? ctx.poolId ?? ''}|${id}|${answer}`,
      });
    });
    return { items: out };
  }
}
