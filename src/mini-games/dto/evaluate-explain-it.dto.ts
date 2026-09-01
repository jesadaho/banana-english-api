import { IsNotEmpty, IsString } from 'class-validator';

export class EvaluateExplainItDto {
  @IsString()
  @IsNotEmpty()
  transcript!: string;

  @IsString()
  @IsNotEmpty()
  targetEn!: string;

  @IsString()
  @IsNotEmpty()
  emoji!: string;

  @IsString()
  @IsNotEmpty()
  exampleDescriptionEn!: string;
}
