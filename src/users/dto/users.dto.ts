import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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
  @IsIn(['thai', 'english'])
  lessonTeachingLanguage?: 'thai' | 'english';

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

export class EnglishLevelSurveyDto {
  @IsString()
  @IsIn(['beginner', 'elementary', 'intermediate', 'advanced'])
  level!: 'beginner' | 'elementary' | 'intermediate' | 'advanced';
}

export class UnlockAvatarDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  avatarId!: string;

  /** Client-reported Perfect Star count (minigames). Used for gated avatars. */
  @IsOptional()
  @IsInt()
  @Min(0)
  perfectMinigameStars?: number;
}

export class RefillBananasByNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;
}
