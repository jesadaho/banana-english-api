import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TtsSegmentDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class SynthesizeTtsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TtsSegmentDto)
  segments!: TtsSegmentDto[];
}
