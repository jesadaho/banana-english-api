import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StartSessionDto {
  @ValidateIf((o: StartSessionDto) => !o.sessionType)
  @IsString()
  @IsNotEmpty()
  topicId?: string;

  @IsOptional()
  @IsIn(['simulation', 'training'])
  sessionType?: 'simulation' | 'training';

  @ValidateIf((o: StartSessionDto) => o.sessionType === 'simulation')
  @IsString()
  @IsNotEmpty()
  simulationId?: string;

  @ValidateIf((o: StartSessionDto) => o.sessionType === 'training')
  @IsString()
  @IsNotEmpty()
  lessonId?: string;

  @IsOptional()
  @IsBoolean()
  isDailyMission?: boolean;

  /** Free Talk only: 5 or 10 minutes (default 5). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([5, 10])
  durationMinutes?: number;

  /** Free Talk only: Easy / Balanced / English Only (default balanced). */
  @IsOptional()
  @IsIn(['easy', 'balanced', 'englishOnly'])
  languageLevel?: 'easy' | 'balanced' | 'englishOnly';

  /** Training only: Thai-heavy or English-heavy tutor speech (default thai). */
  @IsOptional()
  @IsIn(['thai', 'english'])
  teachingLanguage?: 'thai' | 'english';
}

export class TurnDto {
  @IsOptional()
  @IsString()
  transcript?: string;

  @IsOptional()
  @IsString()
  userSpeechText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentTurn?: number;

  @IsOptional()
  @IsBoolean()
  thaiMixEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  generateAudio?: boolean;

  /** Free Talk: client countdown remaining seconds (wrap-up bias). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  remainingSeconds?: number;
}

class SttWordMetricDto {
  @IsString()
  word!: string;

  @IsOptional()
  @Type(() => Number)
  start?: number;

  @IsOptional()
  @Type(() => Number)
  end?: number;

  @IsOptional()
  @Type(() => Number)
  segmentAvgLogprob?: number;
}

class TurnSpeakingMetricsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  responseLatencyMs?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  micDurationMs!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  wordCount!: number;

  @IsBoolean()
  usedHint!: boolean;

  @IsBoolean()
  attempted!: boolean;

  @IsOptional()
  @IsString()
  transcript?: string;

  @IsOptional()
  @Type(() => SttWordMetricDto)
  sttWords?: SttWordMetricDto[];

  @IsOptional()
  @IsString({ each: true })
  mispronouncedWords?: string[];
}

class SpeakingMetricsDto {
  @Type(() => TurnSpeakingMetricsDto)
  turns!: TurnSpeakingMetricsDto[];
}

export class EndSessionDto {
  @IsOptional()
  @Type(() => SpeakingMetricsDto)
  speakingMetrics?: SpeakingMetricsDto;
}

export class ExtractIntroNameDto {
  @IsString()
  @IsNotEmpty()
  transcript!: string;
}
