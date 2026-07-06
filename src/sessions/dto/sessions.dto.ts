import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class StartSessionDto {
  @IsString()
  @IsNotEmpty()
  topicId!: string;
}

export class TurnDto {
  @IsString()
  @IsNotEmpty()
  transcript!: string;

  @IsBoolean()
  thaiMixEnabled!: boolean;
}
