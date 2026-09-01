import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EvaluateSpeakChallengeDto {
  @IsString()
  @IsNotEmpty()
  transcript!: string;

  @IsString()
  @IsNotEmpty()
  targetEn!: string;

  @IsOptional()
  @IsString()
  promptTh?: string;

  @IsOptional()
  @IsString()
  promptEn?: string;
}
