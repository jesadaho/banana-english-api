import { Injectable } from '@nestjs/common';
import {
  getAllSimulations,
  getSimulation,
  SimulationConfig,
} from './simulations.data';

@Injectable()
export class SimulationsService {
  getAll(): SimulationConfig[] {
    return getAllSimulations();
  }

  getById(simulationId: string): SimulationConfig | undefined {
    return getSimulation(simulationId);
  }
}
