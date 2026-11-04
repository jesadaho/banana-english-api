import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthGuard } from './admin-auth.guard';

@Controller('admin/users')
@UseGuards(AdminAuthGuard)
export class AdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch(':id/community-admin')
  async setCommunityAdmin(
    @Param('id') id: string,
    @Body() body: { enabled?: boolean },
  ) {
    const userId = id?.trim();
    if (!userId) throw new BadRequestException('Missing userId');
    if (typeof body.enabled !== 'boolean') {
      throw new BadRequestException('enabled must be boolean');
    }
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { communityAdmin: body.enabled },
        select: { id: true, communityAdmin: true, displayName: true },
      });
    } catch {
      throw new NotFoundException('user not found');
    }
  }
}
