import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { FirebaseIdToken } from '../users/firebase-id-token.decorator';
import { UserAuthService } from '../users/user-auth.service';
import { ClaimPurchaseDto } from './dto/claim-purchase.dto';
import { listBananaPacks } from './product-catalog';
import { PurchasesService } from './purchases.service';

type AuthedRequest = {
  user: User;
  headers: Record<string, string | undefined>;
};

@Controller('purchases')
export class PurchasesController {
  constructor(
    private readonly purchases: PurchasesService,
    private readonly userAuth: UserAuthService,
  ) {}

  @Get('catalog')
  catalog() {
    return { packs: listBananaPacks() };
  }

  @Post('attempts')
  @UseGuards(AnonymousUserGuard)
  async recordAttempt(
    @Req() req: AuthedRequest,
    @FirebaseIdToken() idToken: string | null,
    @Body() body: ClaimPurchaseDto,
  ) {
    const user = await this.resolvePurchaseUser(req.user, idToken);
    return this.purchases.recordStorePaid({
      userId: user.id,
      appUserId: user.firebaseUid,
      productId: body.productId,
      storeTransactionId: body.storeTransactionId,
      platform: body.platform,
      source: 'app',
    });
  }

  @Post('claim')
  @UseGuards(AnonymousUserGuard)
  async claim(
    @Req() req: AuthedRequest,
    @FirebaseIdToken() idToken: string | null,
    @Body() body: ClaimPurchaseDto,
  ) {
    const user = await this.resolvePurchaseUser(req.user, idToken);
    return this.purchases.claimPurchase(user, {
      productId: body.productId,
      storeTransactionId: body.storeTransactionId,
      platform: body.platform,
      source: 'app',
    });
  }

  @Post('revenuecat-webhook')
  async revenueCatWebhook(
    @Req() req: AuthedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    this.purchases.verifyRevenueCatWebhookAuth(req.headers.authorization);
    await this.purchases.handleRevenueCatWebhook(
      body as Parameters<PurchasesService['handleRevenueCatWebhook']>[0],
    );
    return { ok: true };
  }

  /** Bind Firebase Auth UID (guest anonymous OK) so RevenueCat can verify the tx. */
  private async resolvePurchaseUser(user: User, idToken: string | null): Promise<User> {
    if (!idToken) {
      if (user.firebaseUid) return user;
      throw new UnauthorizedException('Missing Bearer ID token');
    }
    return this.userAuth.attachFirebaseUidFromToken(user, idToken);
  }
}
