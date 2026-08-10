import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import { UsersModule } from '../users/users.module';
import { MiniGamesController } from './mini-games.controller';
import { SpeakChallengeEvaluateService } from './speak-challenge-evaluate.service';
import { StoryBuilderEvaluateService } from './story-builder-evaluate.service';

@Module({
  imports: [EconomyModule, UsersModule],
  controllers: [MiniGamesController],
  providers: [SpeakChallengeEvaluateService, StoryBuilderEvaluateService],
})
export class MiniGamesModule {}
