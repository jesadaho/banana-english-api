import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { buildTapChoices } from './tap-choices';
import { tapDistractorWords, type TapContext } from './tap-vocab';

type TapItemBody = { id?: unknown; answer?: unknown; accepted?: unknown; options?: unknown };

const MAX_ITEMS = 40;

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
