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
}
