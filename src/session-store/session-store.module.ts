import { Global, Module } from '@nestjs/common';
import {
  PrismaSessionPersistence,
  SESSION_PERSISTENCE,
} from './session-persistence';
import { SessionPersistenceInterceptor } from './session-persistence.interceptor';
import { SessionStoreService } from './session-store.service';

@Global()
@Module({
  providers: [
    SessionStoreService,
    SessionPersistenceInterceptor,
    { provide: SESSION_PERSISTENCE, useClass: PrismaSessionPersistence },
  ],
  exports: [SessionStoreService, SessionPersistenceInterceptor],
})
export class SessionStoreModule {}
