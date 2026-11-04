import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class SubmitLiveTalkRatingDto {
  @IsIn(['up', 'down'])
  rating!: 'up' | 'down';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  listenedSeconds?: number;
}
