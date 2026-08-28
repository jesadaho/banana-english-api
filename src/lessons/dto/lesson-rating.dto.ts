import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateLessonRatingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lessonId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  stars!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  sessionId?: string;
}
