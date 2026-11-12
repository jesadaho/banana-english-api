import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EconomyService } from '../economy/economy.service';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { effectiveSubscriptionTier } from '../subscriptions/subscription.constants';
import {
  CLIP_FREE_UNLOCKS,
  CLIP_UNLOCK_COST,
  type ClipAccessKind,
  decideClipAccess,
  lockEnabledFrom,
  wordAccessAllowed,
} from './clip-access.rules';

export type ClipAccessView = {
  /** unlocked → practise; locked → show the unlock card; insufficient → "not enough bananas" sheet. */
  status: 'unlocked' | 'locked' | 'insufficient';
  kind: ClipAccessKind | null;
  /** Send back as `unlock` with word-meaning requests (null when not needed). */
  token: string | null;
  cost: number;
  bananaBalance: number;
  freeLeft: number;
};

/** Clips practice lock (RC `clips_lock_enabled`): 3 free clips, then 2 🍌 per clip session; Pro Max never locked. */
@Injectable()
export class ClipAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly economy: EconomyService,
    @Optional() private readonly firebase?: FirebaseAdminService,
  ) {}

  private async lockEnabled(): Promise<boolean> {
    return lockEnabledFrom(await this.firebase?.getRemoteConfigStrings());
  }

  /** [spend] false = check only (entering a practice tab / tapping a word); true = pay 2 🍌. */
  async unlock(
    userId: string,
    clipId: string,
    opts: { spend?: boolean; token?: string | null },
  ): Promise<ClipAccessView> {
    const clip = await this.prisma.clip.findUnique({
      where: { id: clipId },
      select: { status: true },
    });
    if (!clip || clip.status !== 'published') throw new NotFoundException('clip_not_found');

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const [existing, freeUsed] = await Promise.all([
      this.prisma.clipUnlock.findMany({
        where: { userId, clipId },
        select: { id: true, kind: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.clipUnlock.count({ where: { userId, kind: 'free' } }),
    ]);
    const decision = decideClipAccess({
      lockEnabled: await this.lockEnabled(),
      proMax: effectiveSubscriptionTier(user) === 'PRO_MAX',
      existing,
      token: opts.token,
      freeUsed,
      balance: user.bananaBalance,
      spend: !!opts.spend,
    });
    const freeLeft = Math.max(0, CLIP_FREE_UNLOCKS - freeUsed);
    const view = (
      status: ClipAccessView['status'],
      kind: ClipAccessKind | null,
      token: string | null,
      balance = user.bananaBalance,
      left = freeLeft,
    ): ClipAccessView => ({
      status,
      kind,
      token,
      cost: CLIP_UNLOCK_COST,
      bananaBalance: balance,
      freeLeft: left,
    });

    switch (decision.status) {
      case 'unlocked':
        return view('unlocked', decision.kind, decision.reuseUnlockId ?? null);
      case 'locked':
        return view('locked', null, null);
      case 'insufficient':
        return view('insufficient', null, null);
      case 'create_free': {
        const row = await this.prisma.clipUnlock.create({
          data: { userId, clipId, kind: 'free' },
        });
        return view('unlocked', 'free', row.id, user.bananaBalance, freeLeft - 1);
      }
      case 'spend': {
        const row = await this.prisma.clipUnlock.create({
          data: { userId, clipId, kind: 'banana' },
        });
        try {
          const after = await this.economy.spendBananas(
            userId,
            CLIP_UNLOCK_COST,
            `clip_unlock:${row.id}`,
            'clip_unlock',
          );
          return view('unlocked', 'banana', row.id, after.bananaBalance);
        } catch (err) {
          await this.prisma.clipUnlock.delete({ where: { id: row.id } }).catch(() => undefined);
          const fresh = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { bananaBalance: true },
          });
          if ((fresh?.bananaBalance ?? 0) < CLIP_UNLOCK_COST) {
            return view('insufficient', null, null, fresh?.bananaBalance ?? 0);
          }
          throw err;
        }
      }
    }
  }

  /** Throws 403 `clip_locked` when the lock is on and [token] doesn't unlock [clipId]. */
  async assertWordAccess(userId: string, clipId: string, token?: string | null): Promise<void> {
    const lockEnabled = await this.lockEnabled();
    if (!lockEnabled) return;
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { subscriptionTier: true, subscriptionExpiresAt: true },
    });
    const existing = await this.prisma.clipUnlock.findMany({
      where: { userId, clipId },
      select: { id: true, kind: true, createdAt: true },
    });
    const ok = wordAccessAllowed({
      lockEnabled,
      proMax: effectiveSubscriptionTier(user) === 'PRO_MAX',
      existing,
      token,
    });
    if (!ok) throw new ForbiddenException('clip_locked');
  }
}
