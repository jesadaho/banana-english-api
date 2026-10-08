import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EvaluateDescribeItDto {
  @IsString()
  @IsNotEmpty()
  transcript!: string;

  @IsString()
  @IsNotEmpty()
  targetEn!: string;

  @IsOptional()
  @IsString()
  promptTh?: string;

  /** Other accepted sentences, joined with " | ". */
  @IsOptional()
  @IsString()
  acceptedEn?: string;
}
