import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { AnonymousUserGuard } from '../users/anonymous-user.guard';
import { ClaimPurchaseDto } from './dto/claim-purchase.dto';
import { listBananaPacks } from './product-catalog';
import { PurchasesService } from './purchases.service';

type AuthedRequest = {
  user: User;
  headers: Record<string, string | undefined>;
};

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get('catalog')
  catalog() {
    return { packs: listBananaPacks() };
  }

  @Post('attempts')
  @UseGuards(AnonymousUserGuard)
  async recordAttempt(@Req() req: AuthedRequest, @Body() body: ClaimPurchaseDto) {
    return this.purchases.recordStorePaid({
      userId: req.user.id,
      appUserId: req.user.firebaseUid,
      productId: body.productId,
      storeTransactionId: body.storeTransactionId,
      platform: body.platform,
      source: 'app',
    });
  }

  @Post('claim')
  @UseGuards(AnonymousUserGuard)
  async claim(@Req() req: AuthedRequest, @Body() body: ClaimPurchaseDto) {
    return this.purchases.claimPurchase(req.user, {
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
}
