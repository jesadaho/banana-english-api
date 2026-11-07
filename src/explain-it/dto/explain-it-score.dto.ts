import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ExplainItScoreDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2000)
  score!: number;

  @IsOptional()
  @IsString()
  avatarId?: string;

  /** Re-seed classic board only — do not write the active event leaderboard. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  syncOnly?: boolean;
}
