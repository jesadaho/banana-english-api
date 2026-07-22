import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  fcmToken?: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

export class CompleteOnboardingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;
}

export class UnlockAvatarDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  avatarId!: string;
}

export class RefillBananasByNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;
}
