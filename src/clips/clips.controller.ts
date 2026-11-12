import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { ClipAccessService } from './clip-access.service';
import { ClipSessionsService } from './clip-sessions.service';
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
    private readonly access: ClipAccessService,
    private readonly sessions: ClipSessionsService,
  ) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.clips.listForUser(req.user.id);
  }

  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.clips.getForUser(req.user.id, id);
  }

  /**
   * Practice lock (Dictation · Shadowing · word meanings). `spend: false`
   * checks (free clip / Pro Max / lock off unlock right away); `spend: true`
   * pays 2 bananas. `token` = the unlock the app still holds for this page.
   */
  @Post(':id/unlock')
  unlock(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { spend?: boolean; token?: string },
  ) {
    return this.access.unlock(req.user.id, id, {
      spend: body?.spend === true,
      token: typeof body?.token === 'string' ? body.token : null,
    });
  }

  /** Tap a word in line [idx] → Thai meaning in context (cached server-side). */
  @Get(':id/sentences/:idx/words/:wordIdx')
  async word(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('idx', ParseIntPipe) idx: number,
    @Param('wordIdx', ParseIntPipe) wordIdx: number,
    @Query('unlock') unlock?: string,
  ) {
    await this.access.assertWordAccess(req.user.id, id, unlock);
    return this.words.gloss(req.user.id, id, idx, wordIdx);
  }

  /** A mode opened on the clip page (watch | dictation | shadowing). */
  @Post(':id/session')
  session(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: { mode?: string }) {
    return this.sessions.log(req.user.id, id, body?.mode);
  }

  /** That mode was played to the end (watch: past the last line; practice: summary). */
  @Post(':id/session/complete')
  sessionComplete(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: { mode?: string }) {
    return this.sessions.complete(req.user.id, id, body?.mode);
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
