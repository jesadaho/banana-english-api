import { Module } from '@nestjs/common';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { EconomyModule } from '../economy/economy.module';
import { AdminClipsController } from './admin-clips.controller';
import { ClipAccessService } from './clip-access.service';
import { ClipSessionsService } from './clip-sessions.service';
import { ClipsController } from './clips.controller';
import { CcImportService } from './cc-import.service';
import { ClipWordsService } from './clip-words.service';
import { ClipsSeedService } from './clips-seed.service';
import { ClipsService } from './clips.service';
import { VoaImportService } from './voa-import.service';

@Module({
  imports: [EconomyModule],
  controllers: [ClipsController, AdminClipsController],
  providers: [
    ClipAccessService,
    ClipSessionsService,
    ClipsService,
    ClipWordsService,
    VoaImportService,
    CcImportService,
    ClipsSeedService,
    AdminAuthGuard,
  ],
})
export class ClipsModule {}
