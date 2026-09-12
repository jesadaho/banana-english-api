import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminLedgerService } from './admin-ledger.service';
import { AdminCreditBananasDto } from './dto/admin-credit-bananas.dto';

@Controller('admin/ledger')
@UseGuards(AdminAuthGuard)
export class AdminLedgerController {
  constructor(private readonly ledger: AdminLedgerService) {}

  @Get('users')
  search(@Query('q') q?: string) {
    return this.ledger.searchUsers(q);
  }

  @Get('users/:userId')
  getLedger(@Param('userId') userId: string) {
    return this.ledger.getLedger(userId);
  }

  @Post('users/:userId/credit')
  credit(
    @Param('userId') userId: string,
    @Body() body: AdminCreditBananasDto,
    @Req() req: { adminEmail?: string },
  ) {
    return this.ledger.creditBananas(userId, body, req.adminEmail ?? 'unknown');
  }
}