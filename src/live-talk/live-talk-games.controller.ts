import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { LiveTalkGamesService } from './live-talk-games.service';

type AuthedRequest = { user: User };

/** Live Talk mini games. State is also pushed on the LiveKit topic `lt-game`. */
@Controller('live-talk/rooms/:id/game')
@UseGuards(AnonymousUserGuard)
export class LiveTalkGamesController {
  constructor(private readonly games: LiveTalkGamesService) {}

  /** Current game (null when none) — for late joiners / missed packets. */
  @Get()
  view(@Param('id') id: string) {
    return this.games.view(id);
  }

  /** Host / co-host: `{ type: 'draw' | 'who', level?: 'A1' | 'A2', turnSeconds? }`. */
  @Post('start')
  start(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { type?: unknown; level?: unknown; turnSeconds?: unknown },
  ) {
    return this.games.start(req.user.id, id, body ?? {});
  }

  @Post('stop')
  stop(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.games.stop(req.user.id, id);
  }

  /** Drawer: the word. Who Am I?: the asker's card (everyone but the asker). */
  @Get('secret')
  secret(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.games.secret(req.user.id, id);
  }

  @Post('change-word')
  changeWord(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.games.changeWord(req.user.id, id);
  }

  /** Draw & Guess Game Mic: `{ transcript }` (STT on the device). */
  @Post('guess')
  guess(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { transcript?: unknown },
  ) {
    return this.games.guess(req.user.id, id, body?.transcript);
  }

  /** Who Am I?: "Correct!" for the asker. */
  @Post('correct')
  correct(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.games.correct(req.user.id, id);
  }
}
