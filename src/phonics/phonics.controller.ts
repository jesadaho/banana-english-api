import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { CheckPhonicsNodeDto } from './dto/check-phonics-node.dto';
import { PhonicsService } from './phonics.service';

type AuthedRequest = { user: User };

@Controller('phonics')
@UseGuards(AnonymousUserGuard)
export class PhonicsController {
  constructor(private readonly phonics: PhonicsService) {}

  @Get('course')
  getCourse(@Req() req: AuthedRequest) {
    return this.phonics.getCourse(req.user.id);
  }

  @Get('nodes/:nodeId')
  getNode(@Param('nodeId') nodeId: string) {
    return this.phonics.getNode(nodeId);
  }

  @Post('nodes/:nodeId/check')
  checkNode(
    @Req() req: AuthedRequest,
    @Param('nodeId') nodeId: string,
    @Body() body: CheckPhonicsNodeDto,
  ) {
    return this.phonics.checkNode(req.user.id, { ...body, nodeId });
  }
}
