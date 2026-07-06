import { Global, Module } from '@nestjs/common';
import { SessionStoreService } from './session-store.service';

@Global()
@Module({
  providers: [SessionStoreService],
  exports: [SessionStoreService],
})
export class SessionStoreModule {}
