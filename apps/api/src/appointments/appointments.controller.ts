import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AppointmentsService } from './appointments.service';
import {
  CancelAppointmentDto,
  AppointmentCalendarQueryDto,
  CreateAppointmentDto,
  CustomerAppointmentsQueryDto,
  RescheduleAppointmentDto,
  UpdateAppointmentStatusDto,
} from './dto/appointment.dto';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@Controller('appointments')
@ApiTags('appointments')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Create a customer or local operational appointment',
    description:
      'CUSTOMER books for their own account. BARBER and MASTER must provide customerName; customerPhone is optional and links an active customer account when matched.',
  })
  @ApiCreatedResponse({ description: 'Appointment confirmed.' })
  @ApiConflictResponse({
    description:
      'Slot conflict, or the single-booking cap that applies while a customer carries an unjustified no-show.',
  })
  @ApiForbiddenResponse({ description: 'Schedule ownership violation.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List an authorized calendar period' })
  @ApiOkResponse({ description: 'Paginated day, week, or month calendar.' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AppointmentCalendarQueryDto,
  ) {
    return this.appointmentsService.list(user, query);
  }

  @Get('mine')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CustomerAppointmentsQueryDto,
  ) {
    return this.appointmentsService.listMine(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read authorized appointment details' })
  @ApiOkResponse({ description: 'Appointment details.' })
  @ApiNotFoundResponse({ description: 'Appointment not found.' })
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.appointmentsService.detail(user, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel an active appointment' })
  @ApiOkResponse({ description: 'Appointment cancelled.' })
  @ApiConflictResponse({ description: 'Appointment is no longer active.' })
  @ApiForbiddenResponse({ description: 'Ownership or notice rule violation.' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentsService.cancel(user, id, dto.reason);
  }

  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule an active appointment' })
  @ApiOkResponse({ description: 'Appointment rescheduled.' })
  @ApiConflictResponse({ description: 'New slot is unavailable.' })
  reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointmentsService.reschedule(user, id, dto.startsAt);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Close an appointment as completed or no-show' })
  @ApiOkResponse({ description: 'Appointment lifecycle updated.' })
  @ApiForbiddenResponse({ description: 'Customers cannot close appointments.' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.updateStatus(
      user,
      id,
      dto.status,
      dto.justification,
    );
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Read immutable appointment history' })
  @ApiOkResponse({ description: 'Authorized appointment history.' })
  history(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.appointmentsService.history(user, id);
  }
}
