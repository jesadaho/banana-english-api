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
