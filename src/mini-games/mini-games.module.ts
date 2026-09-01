import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { EmojiSpeakEndlessLeaderboardService } from './emoji-speak-endless-leaderboard.service';
import { ExplainItEvaluateService } from './explain-it-evaluate.service';
import { MiniGamesController } from './mini-games.controller';
import { SpeakChallengeEvaluateService } from './speak-challenge-evaluate.service';
import { StoryBuilderEvaluateService } from './story-builder-evaluate.service';

@Module({
  imports: [EconomyModule, UsersModule],
  controllers: [MiniGamesController],
  providers: [
    SpeakChallengeEvaluateService,
    ExplainItEvaluateService,
    StoryBuilderEvaluateService,
    EmojiSpeakEndlessLeaderboardService,
  ],
})
export class MiniGamesModule {}
