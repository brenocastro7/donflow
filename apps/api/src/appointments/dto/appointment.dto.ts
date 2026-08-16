import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AppointmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AppointmentCalendarView {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class CreateAppointmentDto {
  @ApiProperty({
    description: 'Service offered by the selected barber.',
    format: 'uuid',
  })
  @IsUUID()
  barberServiceId!: string;

  @ApiProperty({
    description: 'Appointment start as an ISO 8601 instant.',
    example: '2026-08-03T08:00:00.000Z',
  })
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional({
    description:
      'Existing customer identity selected by BARBER or MASTER. Ignored for CUSTOMER bookings.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  customerUserId?: string;

  @ApiPropertyOptional({
    description:
      'Required for BARBER or MASTER local bookings. Stored only on the appointment when no account is matched.',
    example: 'Joao Silva',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @ApiPropertyOptional({
    description:
      'Optional E.164 phone for a local booking. An active CUSTOMER account with the same phone is linked automatically.',
    example: '+351912345678',
  })
  @IsOptional()
  @IsPhoneNumber(undefined, {
    message: 'O telemóvel deve estar no formato internacional.',
  })
  customerPhone?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CancelAppointmentDto {
  @ApiPropertyOptional({
    description: 'Operational cancellation reason.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RescheduleAppointmentDto {
  @ApiProperty({
    description: 'New appointment start as an ISO 8601 instant.',
    example: '2026-08-04T14:00:00.000Z',
  })
  @IsDateString()
  startsAt!: string;
}

export class AppointmentCalendarQueryDto {
  @ApiProperty({
    enum: AppointmentCalendarView,
    default: AppointmentCalendarView.DAY,
  })
  @IsEnum(AppointmentCalendarView)
  view: AppointmentCalendarView = AppointmentCalendarView.DAY;

  @ApiProperty({ example: '2026-08-03', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  barberProfileId?: string;

  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiProperty({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiProperty({ default: 25, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

export class UpdateAppointmentStatusDto {
  @ApiProperty({
    enum: [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW],
  })
  @IsIn([AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW])
  status!: 'COMPLETED' | 'NO_SHOW';

  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  justification?: string;
}

export enum CustomerAppointmentScope {
  UPCOMING = 'upcoming',
  HISTORY = 'history',
}

export class CustomerAppointmentsQueryDto {
  @IsEnum(CustomerAppointmentScope)
  scope: CustomerAppointmentScope = CustomerAppointmentScope.UPCOMING;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
