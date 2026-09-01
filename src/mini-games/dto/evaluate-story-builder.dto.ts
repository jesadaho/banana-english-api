import { IsNotEmpty, IsString } from 'class-validator';

export class EvaluateStoryBuilderDto {
  @IsString()
  @IsNotEmpty()
  transcript!: string;

  @IsString()
  @IsNotEmpty()
  emojiSet!: string;

  @IsString()
  @IsNotEmpty()
  targetEn!: string;
}
