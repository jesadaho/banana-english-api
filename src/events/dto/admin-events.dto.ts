import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EVENT_GAME_KEYS } from '../event.types';

export class AdminEventTierDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  rankFrom!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  rankTo!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  avatarId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarImageUrl?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nameTh!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nameEn!: string;
}

export class AdminCreateEventDto {
  @IsString()
  @IsIn([...EVENT_GAME_KEYS])
  gameKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  topicId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  startsAt!: string;

  @IsString()
  @MinLength(1)
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoDistributeRewards?: boolean;

  @IsOptional()
  @IsBoolean()
  rewardHold?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  headlineTh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  headlineEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ctaRoute?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AdminEventTierDto)
  rewardTiers?: AdminEventTierDto[];
}

export class AdminUpdateEventDto {
  @IsOptional()
  @IsString()
  @IsIn([...EVENT_GAME_KEYS])
  gameKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  topicId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  startsAt?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoDistributeRewards?: boolean;

  @IsOptional()
  @IsBoolean()
  rewardHold?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  headlineTh?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  headlineEn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerImageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ctaRoute?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AdminEventTierDto)
  rewardTiers?: AdminEventTierDto[];
}

export class AdminHoldRewardsDto {
  @IsBoolean()
  hold!: boolean;
}
