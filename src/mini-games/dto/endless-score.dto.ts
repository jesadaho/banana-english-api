import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class EndlessScoreDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  score!: number;

  @IsOptional()
  @IsString()
  avatarId?: string;

  /**
   * Client re-seeds the classic board from a local high before reading it.
   * Must not count toward an active event (that would import all-time scores).
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  syncOnly?: boolean;
}
