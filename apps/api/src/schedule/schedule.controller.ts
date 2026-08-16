import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateScheduleBlockDto,
  ReplaceBusinessHoursDto,
} from './dto/schedule.dto';
import { ScheduleService } from './schedule.service';

@Controller()
@UseGuards(RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('barbers/:barberProfileId/business-hours')
  getHours(@Param('barberProfileId') barberProfileId: string) {
    return this.scheduleService.getBusinessHours(barberProfileId);
  }

  @Put('barbers/:barberProfileId/business-hours')
  @Roles(UserRole.BARBER, UserRole.MASTER)
  replaceHours(
    @CurrentUser() user: AuthenticatedUser,
    @Param('barberProfileId') barberProfileId: string,
    @Body() dto: ReplaceBusinessHoursDto,
  ) {
    return this.scheduleService.replaceBusinessHours(
      user,
      barberProfileId,
      dto.hours,
    );
  }

  @Post('barbers/:barberProfileId/schedule-blocks')
  @Roles(UserRole.BARBER, UserRole.MASTER)
  createBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('barberProfileId') barberProfileId: string,
    @Body() dto: CreateScheduleBlockDto,
  ) {
    return this.scheduleService.createBlock(user, barberProfileId, dto);
  }

  @Get('barbers/:barberProfileId/schedule-blocks')
  @Roles(UserRole.BARBER, UserRole.MASTER)
  getBlocks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('barberProfileId') barberProfileId: string,
  ) {
    return this.scheduleService.getBlocks(user, barberProfileId);
  }

  @Delete('schedule-blocks/:id')
  @Roles(UserRole.BARBER, UserRole.MASTER)
  deleteBlock(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scheduleService.deleteBlock(user, id);
  }
}
