import { Controller, Get, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AvailabilityService } from './availability.service';
import {
  AvailabilityCalendarQueryDto,
  AvailabilityQueryDto,
} from './dto/availability-query.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('calendar')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getAvailabilityCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AvailabilityCalendarQueryDto,
  ) {
    return this.availabilityService.getAvailabilityCalendar(user, query);
  }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.availabilityService.getAvailability(user, query);
  }
}
