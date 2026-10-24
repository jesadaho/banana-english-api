import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, lastValueFrom, Observable } from 'rxjs';
import { SessionStoreService } from './session-store.service';

/**
 * Before a session request: load the session from the DB when this instance
 * does not have it in memory (after a deploy/restart). After it: write every
 * session the handler touched back to the DB, even when the handler threw.
 */
@Injectable()
export class SessionPersistenceInterceptor implements NestInterceptor {
  constructor(private readonly store: SessionStoreService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ params?: Record<string, string> }>();
    const sessionId = req?.params?.sessionId;
    return from(
      this.store.runInRequest(async () => {
        if (sessionId) await this.store.hydrate(sessionId);
        try {
          return await lastValueFrom(next.handle(), { defaultValue: undefined });
        } finally {
          await this.store.flushTouched();
        }
      }),
    );
  }
}
