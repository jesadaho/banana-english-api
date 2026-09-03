import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ClaimPurchaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  productId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  storeTransactionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  platform?: string;
}
