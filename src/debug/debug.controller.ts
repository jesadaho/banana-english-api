import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertDebugEndpointsEnabled } from '../common/debug-endpoints';
import { DebugService } from './debug.service';
import { TrainingLlmBenchDto } from './dto/training-llm-bench.dto';

@Controller('debug')
export class DebugController {
  constructor(
    private readonly debugService: DebugService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Simulate one training lesson opening (+ optional turn) across Gemini and Groq.
   * Does not create a session or spend bananas.
   *
   * Guard: ENABLE_DEBUG_ENDPOINTS=true (or non-production NODE_ENV).
   */
  @Post('training-llm-bench')
  benchTrainingLlm(@Body() body: TrainingLlmBenchDto) {
    assertDebugEndpointsEnabled(this.config);
    return this.debugService.benchTrainingLlm(body);
  }
}
