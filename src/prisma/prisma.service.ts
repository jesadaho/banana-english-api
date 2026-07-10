import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.error('DATABASE_URL is not set');
      return;
    }

    try {
      await this.$connect();
      this.connected = true;
      this.logger.log('Database connected');
    } catch (error) {
      this.logger.error(
        `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy() {
    if (!this.connected) return;
    await this.$disconnect();
  }

  get isReady(): boolean {
    return this.connected;
  }
}
