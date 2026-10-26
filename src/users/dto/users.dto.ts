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

  @IsOptional()
  @IsIn(['morning', 'noon', 'evening'])
  reminderSlot?: 'morning' | 'noon' | 'evening';

  /** Choose foundation start after an inconclusive placement without changing the badge. */
  @IsOptional()
  @IsString()
  placementEntryPathId?: string;

  @IsOptional()
  @IsString()
  placementEntryNodeId?: string;
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

export class AcquisitionSourceSurveyDto {
  @IsString()
  @IsIn([
    'tiktok',
    'facebook',
    'friend_line',
    'google',
    'app_store',
    'other',
    'skipped',
  ])
  source!:
    | 'tiktok'
    | 'facebook'
    | 'friend_line'
    | 'google'
    | 'app_store'
    | 'other'
    | 'skipped';
}

export class DemographicsSurveyDto {
  @IsString()
  @IsIn(['female', 'male', 'prefer_not_say'])
  gender!: 'female' | 'male' | 'prefer_not_say';

  @IsString()
  @IsIn(['under_18', '18_24', '25_34', '35_44', '45_plus'])
  ageRange!: 'under_18' | '18_24' | '25_34' | '35_44' | '45_plus';
}

export class UnlockAvatarDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  avatarId!: string;

  /** Legacy client-reported Perfect Star count; used only when none are stored. */
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
