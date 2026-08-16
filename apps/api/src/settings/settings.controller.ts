import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateAccountDto, UpdateShopDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.BARBER, UserRole.MASTER)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('account')
  getAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.getAccount(user.id);
  }

  @Patch('account')
  updateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.settings.updateAccount(user.id, dto);
  }

  @Get('shop')
  getShop() {
    return this.settings.getShop();
  }

  @Patch('shop')
  @Roles(UserRole.MASTER)
  updateShop(@Body() dto: UpdateShopDto) {
    return this.settings.updateShop(dto);
  }
}
