import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { SeriesService } from './series.service';

type AuthedRequest = { user: User };

@Controller('series')
@UseGuards(AnonymousUserGuard)
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @Get()
  async getAll(@Req() req: AuthedRequest) {
    return this.seriesService.getAllForUser(req.user.id);
  }

  @Get(':seriesId')
  async getById(
    @Req() req: AuthedRequest,
    @Param('seriesId') seriesId: string,
  ) {
    const series = await this.seriesService.getByIdForUser(
      req.user.id,
      seriesId,
    );
    if (!series) {
      throw new NotFoundException('Series not found');
    }
    return series;
  }
}
