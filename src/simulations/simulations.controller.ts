import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { RecentLearnersService } from '../recent-learners/recent-learners.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { SimulationsService } from './simulations.service';

type AuthedRequest = { user: User };

@Controller('simulations')
export class SimulationsController {
  constructor(
    private readonly simulationsService: SimulationsService,
    private readonly recentLearners: RecentLearnersService,
  ) {}

  @Get()
  getAll() {
    return this.simulationsService.getAll();
  }

  @Get(':simulationId/recent-learners')
  @UseGuards(AnonymousUserGuard)
  async getRecentLearners(
    @Req() req: AuthedRequest,
    @Param('simulationId') simulationId: string,
  ) {
    const simulation = this.simulationsService.getById(simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }
    return this.recentLearners.getRecent('mission', simulationId, req.user.id);
  }

  @Get(':simulationId')
  getById(@Param('simulationId') simulationId: string) {
    const simulation = this.simulationsService.getById(simulationId);
    if (!simulation) {
      throw new NotFoundException('Simulation not found');
    }
    return simulation;
  }
}
