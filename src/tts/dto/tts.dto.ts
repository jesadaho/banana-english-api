import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TTS_VOICE_PROFILE_IDS,
  type TtsVoiceProfileId,
} from '../tts-voice-profiles';

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

  /** Named voice profile (e.g. teacher_john). Omit = server default voice. */
  @IsOptional()
  @IsIn(TTS_VOICE_PROFILE_IDS)
  voiceProfile?: TtsVoiceProfileId;
}
