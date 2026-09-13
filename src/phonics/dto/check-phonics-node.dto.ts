import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PhonicsAnswerDto {
  @IsInt()
  @Min(0)
  itemIndex!: number;

  /** Choice id, visible option, or ordered tile values. */
  @IsNotEmpty()
  answer!: unknown;
}

export class CheckPhonicsNodeDto {
  @IsString()
  @IsNotEmpty()
  nodeId!: string;

  /** Ignored. Retry count is stored server-side per user + node. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  attemptNumber?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PhonicsAnswerDto)
  answers!: PhonicsAnswerDto[];
}
