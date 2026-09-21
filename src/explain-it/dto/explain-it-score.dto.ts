import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ExplainItScoreDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2000)
  score!: number;

  @IsOptional()
  @IsString()
  avatarId?: string;
}
