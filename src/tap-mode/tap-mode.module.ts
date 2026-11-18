import { Module } from '@nestjs/common';
import { TapModeController } from './tap-mode.controller';

/** Tap Mode ("ไม่สะดวกพูด") word chips. Stateless; reads path content only. */
@Module({ controllers: [TapModeController] })
export class TapModeModule {}
