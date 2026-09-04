import { Module } from '@nestjs/common';
import { LessonsModule } from '../lessons/lessons.module';
import { UsersModule } from '../users/users.module';
import { LearnPathController } from './learn-path.controller';
import { LearnPathService } from './learn-path.service';

@Module({
  imports: [UsersModule, LessonsModule],
  controllers: [LearnPathController],
  providers: [LearnPathService],
  exports: [LearnPathService],
})
export class LearnPathModule {}
