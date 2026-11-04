import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { SubmitLiveTalkRatingDto } from './dto/live-talk-rating.dto';
import { LiveTalkService } from './live-talk.service';

type AuthedRequest = { user: User };

@Controller('live-talk')
@UseGuards(AnonymousUserGuard)
export class LiveTalkController {
  constructor(private readonly liveTalk: LiveTalkService) {}

  @Get('rooms')
  listRooms() {
    return this.liveTalk.listRooms();
  }

  @Post('rooms')
  createRoom(
    @Req() req: AuthedRequest,
    @Body()
    body: { title?: string; description?: string; minSpeakLevel?: string },
  ) {
    return this.liveTalk.createRoom(req.user, body);
  }

  @Post('rooms/:id/join')
  joinRoom(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { role?: string },
  ) {
    const role = body.role === 'speaker' ? 'speaker' : 'listener';
    return this.liveTalk.joinRoom(req.user, id, role);
  }

  @Post('rooms/:id/role')
  changeRole(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { role?: string },
  ) {
    if (body.role !== 'speaker' && body.role !== 'listener') {
      throw new BadRequestException('role must be speaker or listener');
    }
    return this.liveTalk.changeRole(req.user, id, body.role);
  }

  @Post('rooms/:id/rating')
  submitRating(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: SubmitLiveTalkRatingDto,
  ) {
    return this.liveTalk.submitRating(req.user, id, body);
  }

  @Post('rooms/:id/leave')
  leaveRoom(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.liveTalk.leaveRoom(req.user, id);
  }

  @Post('rooms/:id/end')
  endRoom(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.liveTalk.endRoom(req.user, id);
  }
}
