import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TtsSegmentDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsString()
  languageCode?: string;
}

export class SynthesizeTtsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TtsSegmentDto)
  segments!: TtsSegmentDto[];
}
