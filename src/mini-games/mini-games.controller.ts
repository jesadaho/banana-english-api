import {
  BadRequestException,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';

type AuthedRequest = { user: User };

/** Allowed mini-game ids that can claim lesson-sized rewards once. */
const ALLOWED_MINI_GAME_IDS = new Set(['emoji_speak_first_contact']);

@Controller('mini-games')
@UseGuards(AnonymousUserGuard)
export class MiniGamesController {
  constructor(private readonly economy: EconomyService) {}

  @Post(':gameId/complete')
  async complete(
    @Req() req: AuthedRequest,
    @Param('gameId') gameId: string,
  ) {
    if (!ALLOWED_MINI_GAME_IDS.has(gameId)) {
      throw new BadRequestException(`Unknown mini-game: ${gameId}`);
    }

    return this.economy.applyMiniGameRewards({
      userId: req.user.id,
      gameId,
    });
  }
}
