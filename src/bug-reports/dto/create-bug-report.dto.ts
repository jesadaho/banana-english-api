import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBugReportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  screenshotPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  buildNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  route?: string;
}
