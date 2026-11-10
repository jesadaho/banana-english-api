import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { ClipWordsService } from './clip-words.service';
import { ClipsService } from './clips.service';

type AuthedRequest = { user: User };

/** Clips tab (app). */
@Controller('clips')
@UseGuards(AnonymousUserGuard)
export class ClipsController {
  constructor(
    private readonly clips: ClipsService,
    private readonly words: ClipWordsService,
  ) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.clips.listForUser(req.user.id);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.clips.getForUser(req.user.id, id);
  }

  /** Tap a word in line [idx] → Thai meaning in context (cached server-side). */
  @Get(':id/sentences/:idx/words/:wordIdx')
  word(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('idx', ParseIntPipe) idx: number,
    @Param('wordIdx', ParseIntPipe) wordIdx: number,
  ) {
    return this.words.gloss(req.user.id, id, idx, wordIdx);
  }

  @Post(':id/progress')
  progress(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { mode?: string; idx?: number; correct?: boolean; score?: number; completed?: boolean },
  ) {
    return this.clips.saveProgress(req.user.id, id, body);
  }
}
