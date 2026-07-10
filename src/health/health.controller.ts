import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      database: this.prisma.isReady ? 'connected' : 'disconnected',
    };
  }

  @Get('health/ready')
  ready() {
    if (!this.prisma.isReady) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'disconnected',
      });
    }

    return { status: 'ready', database: 'connected' };
  }
}
