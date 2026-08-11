import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { EconomyService } from '../economy/economy.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import {
  SpeakChallengeEvaluateService,
  type SpeakChallengeEvalTier,
} from './speak-challenge-evaluate.service';
import {
  StoryBuilderEvaluateService,
  type StoryBuilderEvalTier,
} from './story-builder-evaluate.service';

type AuthedRequest = { user: User };

/** Allowed mini-game ids that can claim lesson-sized rewards once. */
const ALLOWED_MINI_GAME_IDS = new Set([
  'emoji_speak_first_contact',
  'speak_challenge_ee_everyday_life_1',
  'speak_challenge_ee_about_me_social',
  'speak_challenge_ee_about_me_weather',
  'speak_challenge_ee_everyday_life_hotel',
  'speak_challenge_ee_everyday_life_pharmacy',
  'speak_challenge_ee_everyday_life_survival',
  'speak_challenge_ee_stories_last_weekend',
  'speak_challenge_ee_stories_vacation',
  'speak_challenge_ee_stories_school',
  'speak_challenge_ee_stories_birthday',
  'speak_challenge_ee_stories_last_night',
  'word_choice_ee_about_me_describe',
  'word_choice_ee_around_town_compare',
  'word_choice_ee_stories_yesterday',
  'word_choice_ee_stories_first_time',
  'story_builder_ee_stories_birthday',
  'story_builder_ee_stories_funny',
  'story_builder_ee_stories_favorite',
  'whats_happen_ee_stories_bad_day',
]);

class EvaluateSpeakChallengeDto {
  transcript!: string;
  targetEn!: string;
  promptTh?: string;
  promptEn?: string;
}

class EvaluateStoryBuilderDto {
  transcript!: string;
  emojiSet!: string;
  targetEn!: string;
}

@Controller('mini-games')
@UseGuards(AnonymousUserGuard)
export class MiniGamesController {
  constructor(
    private readonly economy: EconomyService,
    private readonly speakChallengeEval: SpeakChallengeEvaluateService,
    private readonly storyBuilderEval: StoryBuilderEvaluateService,
  ) {}

  @Post('speak-challenge/evaluate')
  async evaluateSpeakChallenge(@Body() body: EvaluateSpeakChallengeDto): Promise<{
    tier: SpeakChallengeEvalTier;
  }> {
    const transcript = body.transcript?.trim() ?? '';
    const targetEn = body.targetEn?.trim() ?? '';
    if (!transcript || !targetEn) {
      throw new BadRequestException('transcript and targetEn are required');
    }

    const tier = await this.speakChallengeEval.evaluate({
      transcript,
      targetEn,
      promptTh: body.promptTh?.trim(),
      promptEn: body.promptEn?.trim(),
    });
    return { tier };
  }

  @Post('story-builder/evaluate')
  async evaluateStoryBuilder(@Body() body: EvaluateStoryBuilderDto): Promise<{
    tier: StoryBuilderEvalTier;
  }> {
    const transcript = body.transcript?.trim() ?? '';
    const emojiSet = body.emojiSet?.trim() ?? '';
    const targetEn = body.targetEn?.trim() ?? '';
    if (!transcript || !emojiSet || !targetEn) {
      throw new BadRequestException(
        'transcript, emojiSet, and targetEn are required',
      );
    }

    const tier = await this.storyBuilderEval.evaluate({
      transcript,
      emojiSet,
      targetEn,
    });
    return { tier };
  }

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
