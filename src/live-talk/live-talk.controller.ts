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
import { LiveTalkScheduleService } from './live-talk-schedule.service';
import { LiveTalkService } from './live-talk.service';

type AuthedRequest = { user: User };

@Controller('live-talk')
@UseGuards(AnonymousUserGuard)
export class LiveTalkController {
  constructor(
    private readonly liveTalk: LiveTalkService,
    private readonly schedule: LiveTalkScheduleService,
  ) {}

  /** Booked sessions coming up (shown when no room is live). */
  @Get('sessions/upcoming')
  upcomingSessions() {
    return this.schedule.upcoming(3);
  }

  @Get('rooms')
  listRooms() {
    return this.liveTalk.listRooms();
  }

  @Get('rooms/:id')
  getRoom(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.liveTalk.getRoom(id, req.user);
  }

  /** Room host names or removes a co-host. */
  @Post('rooms/:id/cohost')
  setCohost(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { userId?: string; on?: boolean },
  ) {
    const userId = body.userId?.trim();
    if (!userId) throw new BadRequestException('userId is required');
    return this.liveTalk.setCohost(req.user, id, userId, body.on !== false);
  }

  /** Host / co-host calls someone up to speak (on) or back to listen (off). */
  @Post('rooms/:id/speaker')
  setSpeaker(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { userId?: string; on?: boolean },
  ) {
    const userId = body.userId?.trim();
    if (!userId) throw new BadRequestException('userId is required');
    return this.liveTalk.setSpeaker(req.user, id, userId, body.on !== false);
  }

  /** Official Host invites someone in the room to become a Host Trainee. */
  @Post('rooms/:id/scout')
  scoutTrainee(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { userId?: string },
  ) {
    const userId = body.userId?.trim();
    if (!userId) throw new BadRequestException('userId is required');
    return this.liveTalk.scoutTrainee(req.user, id, userId);
  }

  @Post('invites/:id/respond')
  respondInvite(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { accept?: boolean },
  ) {
    return this.liveTalk.respondInvite(req.user, id, body.accept === true);
  }

  @Get('me/host')
  myHostStatus(@Req() req: AuthedRequest) {
    return this.liveTalk.myHostStatus(req.user);
  }

  /** Official Host changes a Trainee / Host level (never Official). */
  @Post('hosts/:userId/level')
  setHostLevel(
    @Req() req: AuthedRequest,
    @Param('userId') userId: string,
    @Body() body: { level?: string; note?: string },
  ) {
    return this.liveTalk.setHostLevel(
      req.user,
      userId,
      body.level ?? '',
      body.note,
    );
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

  @Post('rooms/:id/kick')
  kickParticipant(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { userId?: string },
  ) {
    const userId = body.userId?.trim();
    if (!userId) throw new BadRequestException('userId is required');
    return this.liveTalk.kickParticipant(req.user, id, userId);
  }

  @Post('rooms/:id/mute')
  muteParticipant(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { userId?: string; muted?: boolean },
  ) {
    const userId = body.userId?.trim();
    if (!userId) throw new BadRequestException('userId is required');
    if (typeof body.muted !== 'boolean') {
      throw new BadRequestException('muted must be boolean');
    }
    return this.liveTalk.muteParticipant(req.user, id, userId, body.muted);
  }
}
