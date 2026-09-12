import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminCreditBananasDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  bananas?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  storeTransactionId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  platform?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  note!: string;
}
