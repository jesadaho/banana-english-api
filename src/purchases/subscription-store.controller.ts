import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { earlyBirdPayload, SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { FirebaseIdToken } from '../users/firebase-id-token.decorator';
import { UserAuthService } from '../users/user-auth.service';
import { PurchasesService } from './purchases.service';

type AuthedRequest = { user: User };

@Controller()
@UseGuards(AnonymousUserGuard)
export class SubscriptionStoreController {
  constructor(
    private readonly purchases: PurchasesService,
    private readonly subscriptions: SubscriptionsService,
    private readonly userAuth: UserAuthService,
  ) {}

  @Post('early-bird/reservation')
  async reserve(@Req() req: AuthedRequest, @Body() body: { source?: string }) {
    const user = await this.subscriptions.reserveEarlyBird(req.user, body?.source);
    return { earlyBird: earlyBirdPayload(user) };
  }

  @Post('subscriptions/sync')
  async sync(@Req() req: AuthedRequest, @FirebaseIdToken() idToken: string | null) {
    const user = idToken
      ? await this.userAuth.attachFirebaseUidFromToken(req.user, idToken)
      : req.user;
    return this.purchases.syncSubscriptions(user);
  }
}
