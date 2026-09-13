import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { PhonicsModule } from '../phonics/phonics.module';
import { UsersModule } from '../users/users.module';
import { EmojiSpeakService } from '../emoji-speak/emoji-speak.service';
import { EmojiSpeakEndlessLeaderboardService } from './emoji-speak-endless-leaderboard.service';
import { ExplainItEvaluateService } from './explain-it-evaluate.service';
import { MiniGamesController } from './mini-games.controller';
import { SpeakChallengeEvaluateService } from './speak-challenge-evaluate.service';
import { StoryBuilderEvaluateService } from './story-builder-evaluate.service';

@Module({
  imports: [EconomyModule, UsersModule, PhonicsModule],
  controllers: [MiniGamesController],
  providers: [
    SpeakChallengeEvaluateService,
    ExplainItEvaluateService,
    StoryBuilderEvaluateService,
    EmojiSpeakEndlessLeaderboardService,
    EmojiSpeakService,
  ],
})
export class MiniGamesModule {}
