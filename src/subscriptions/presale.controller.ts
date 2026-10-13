import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';

type RawRequest = Request & { rawBody?: Buffer };

@Controller('presale')
export class PresaleController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('status')
  status() {
    return this.subscriptions.publicStatus();
  }

  @Post('orders')
  create(@Body() body: { idToken?: string }) {
    const token = body?.idToken?.trim();
    if (!token) throw new BadRequestException('Missing idToken');
    return this.subscriptions.createPresaleOrder(token);
  }

  @Get('orders/:id')
  getOne(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const token = bearer(authorization);
    return this.subscriptions.presaleOrderForToken(id, token);
  }

  @Post('beam/webhook')
  webhook(
    @Req() req: RawRequest,
    @Headers('x-beam-signature') signature?: string,
    @Headers('x-beam-event') event?: string,
  ) {
    const raw = req.rawBody;
    if (!raw) throw new BadRequestException('Missing raw body');
    return this.subscriptions.handleBeamWebhook(raw, signature, event);
  }
}

function bearer(header?: string): string {
  const match = header ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null;
  const token = match?.[1]?.trim();
  if (!token) throw new UnauthorizedException('Missing Bearer token');
  return token;
}
