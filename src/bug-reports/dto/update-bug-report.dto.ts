import { IsIn, IsString } from 'class-validator';
import {
  BUG_REPORT_STATUSES,
  BugReportStatus,
} from '../bug-report-status';

export class UpdateBugReportDto {
  @IsString()
  @IsIn([...BUG_REPORT_STATUSES])
  status!: BugReportStatus;
}
