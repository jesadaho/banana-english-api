import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EVENT_IMAGE_MAX_BYTES } from '../events/event-upload';
import { EventsService } from '../events/events.service';
import {
  AdminCreateEventDto,
  AdminHoldRewardsDto,
  AdminUpdateEventDto,
} from '../events/dto/admin-events.dto';
import { AdminAuthGuard } from './admin-auth.guard';

@Controller('admin/events')
@UseGuards(AdminAuthGuard)
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list() {
    return this.events.listForAdmin();
  }

  @Get(':id/attempts')
  attempts(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.events.listAttempts(id, limit ? Number(limit) : 100);
  }

  @Get(':id/anomalies')
  anomalies(@Param('id') id: string) {
    return this.events.listAnomalies(id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.events.getForAdmin(id);
  }

  @Post()
  create(@Body() body: AdminCreateEventDto) {
    return this.events.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: AdminUpdateEventDto) {
    return this.events.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.events.remove(id);
  }

  @Post(':id/hold')
  hold(@Param('id') id: string, @Body() body: AdminHoldRewardsDto) {
    return this.events.setRewardHold(id, body.hold);
  }

  @Post(':id/approve-rewards')
  approve(@Param('id') id: string) {
    return this.events.approveRewards(id);
  }

  @Post(':id/snapshot')
  snapshot(@Param('id') id: string) {
    return this.events.forceSnapshot(id);
  }

  @Post(':id/banner')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: EVENT_IMAGE_MAX_BYTES },
    }),
  )
  uploadBanner(
    @Param('id') id: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.events.uploadBanner(id, file);
  }

  @Post(':id/tiers/:tierId/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: EVENT_IMAGE_MAX_BYTES },
    }),
  )
  uploadTierAvatar(
    @Param('id') id: string,
    @Param('tierId') tierId: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.events.uploadTierAvatar(id, tierId, file);
  }
}
