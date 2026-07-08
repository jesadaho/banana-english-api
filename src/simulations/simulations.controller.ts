import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { SimulationsService } from './simulations.service';

@Controller('simulations')
export class SimulationsController {
  constructor(private readonly simulationsService: SimulationsService) {}

  @Get()
  getAll() {
    return this.simulationsService.getAll();
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
