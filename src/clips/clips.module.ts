import { Module } from '@nestjs/common';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { AdminClipsController } from './admin-clips.controller';
import { ClipsController } from './clips.controller';
import { CcImportService } from './cc-import.service';
import { ClipsSeedService } from './clips-seed.service';
import { ClipsService } from './clips.service';
import { VoaImportService } from './voa-import.service';

@Module({
  controllers: [ClipsController, AdminClipsController],
  providers: [
    ClipsService,
    VoaImportService,
    CcImportService,
    ClipsSeedService,
    AdminAuthGuard,
  ],
})
export class ClipsModule {}
