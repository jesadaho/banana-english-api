import { Body, Controller, ForbiddenException, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LiveTalkService } from './live-talk.service';

@Controller('live-talk')
export class LiveTalkWebhookController {
  constructor(
    private readonly liveTalk: LiveTalkService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  async webhook(
    @Req() req: { headers: Record<string, string | string[] | undefined> },
    @Body()
    body: { event?: string; room?: { name?: string }; roomName?: string },
  ) {
    const expected = this.config.get<string>('LIVEKIT_WEBHOOK_KEY')?.trim();
    if (expected) {
      const raw = req.headers['x-livekit-webhook-key'];
      const got = (Array.isArray(raw) ? raw[0] : raw)?.trim();
      if (got !== expected) throw new ForbiddenException('bad webhook key');
    }
    const event = (body.event ?? '').toLowerCase();
    if (event && event !== 'room_finished' && event !== 'room_finished_empty') {
      return { ok: true, ignored: true };
    }
    const name = body.room?.name?.trim() || body.roomName?.trim();
    if (!name) return { ok: true, ended: false };
    return this.liveTalk.endByLivekitName(name);
  }
}
