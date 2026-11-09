import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { CcImportService } from './cc-import.service';
import { ClipsService } from './clips.service';
import { VoaImportService } from './voa-import.service';

/** Admin web clip editor. */
@Controller('admin/clips')
@UseGuards(AdminAuthGuard)
export class AdminClipsController {
  constructor(
    private readonly clips: ClipsService,
    private readonly voa: VoaImportService,
    private readonly cc: CcImportService,
  ) {}

  /** Caption file (.srt/.vtt) + YouTube id → timed clip (AI punctuation + Thai). */
  @Post('import-captions')
  importCaptions(@Body() body: Record<string, unknown>) {
    return this.cc.importCaptions(body);
  }

  /** VOA series page → its lessons (+ which are already imported). */
  @Post('voa/series')
  voaSeries(@Body() body: { url?: string }) {
    return this.voa.listSeries(String(body.url ?? ''));
  }

  /** Import one VOA lesson end-to-end (STT timing + Thai + dictation). */
  @Post('voa/lesson')
  voaLesson(
    @Body() body: { url?: string; level?: string; category?: string; publish?: boolean; replace?: boolean; youtubeUrl?: string },
  ) {
    return this.voa.importLesson(body);
  }

  @Get()
  list() {
    return this.clips.adminList();
  }

  @Post()
  create(@Body() body: { url?: string; level?: string; category?: string; title?: string }) {
    return this.clips.adminCreate(body);
  }

  @Post('parse-transcript')
  parse(@Body() body: { text?: string }) {
    return this.clips.adminParseTranscript(body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.clips.adminGet(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.clips.adminUpdate(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clips.adminDelete(id);
  }

  @Post(':id/sentences')
  saveSentences(@Param('id') id: string, @Body() body: { sentences?: unknown }) {
    return this.clips.adminSaveSentences(id, body);
  }

  @Post(':id/prepare')
  prepare(@Param('id') id: string, @Body() body: { force?: boolean }) {
    return this.clips.adminPrepare(id, body);
  }
}
