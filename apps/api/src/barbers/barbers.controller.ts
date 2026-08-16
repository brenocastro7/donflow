import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BarbersService } from './barbers.service';
import { InviteBarberDto } from './dto/barber-invitation.dto';
import { UpdateBarberStatusDto } from './dto/update-barber-status.dto';

@Controller('barbers')
@UseGuards(RolesGuard)
export class BarbersController {
  constructor(private readonly barbersService: BarbersService) {}

  @Post()
  @Roles(UserRole.MASTER)
  invite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteBarberDto) {
    return this.barbersService.invite(user.id, dto.email);
  }

  @Get('management')
  @Roles(UserRole.MASTER)
  management() {
    return this.barbersService.managementList();
  }

  @Post('invitations/:invitationId/resend')
  @Roles(UserRole.MASTER)
  resendInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invitationId') invitationId: string,
  ) {
    return this.barbersService.resendInvitation(user.id, invitationId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive', new ParseBoolPipe({ optional: true }))
    includeInactive = false,
  ) {
    return this.barbersService.list(
      user.role === UserRole.MASTER && includeInactive,
    );
  }

  @Patch(':barberProfileId/status')
  @Roles(UserRole.MASTER)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('barberProfileId') barberProfileId: string,
    @Body() dto: UpdateBarberStatusDto,
  ) {
    return this.barbersService.updateStatus(
      user.id,
      barberProfileId,
      dto.status,
    );
  }
}
