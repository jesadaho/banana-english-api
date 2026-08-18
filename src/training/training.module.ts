import { Module } from '@nestjs/common';
import { TrainingTurnEngine } from './engine/training-turn.engine';
import { TrainingAiGate } from './engine/ai-gate';

@Module({
  providers: [TrainingTurnEngine, TrainingAiGate],
  exports: [TrainingTurnEngine],
})
export class TrainingModule {}
