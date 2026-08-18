import { IsIn, IsOptional, IsString, IsArray } from 'class-validator';

export class TrainingLlmBenchDto {
  @IsOptional()
  @IsString()
  lessonId?: string;

  /** opening | turn | both (default both) */
  @IsOptional()
  @IsIn(['opening', 'turn', 'both'])
  mode?: 'opening' | 'turn' | 'both';

  @IsOptional()
  @IsString()
  userSpeech?: string;

  @IsOptional()
  @IsArray()
  @IsIn(['gemini', 'groq'], { each: true })
  providers?: Array<'gemini' | 'groq'>;
}
