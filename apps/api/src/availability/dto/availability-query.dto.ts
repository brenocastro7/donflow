import { Type } from 'class-transformer';
import { IsInt, IsUUID, Matches, Max, Min } from 'class-validator';

export class AvailabilityQueryDto {
  @IsUUID()
  barberProfileId!: string;

  @IsUUID()
  barberServiceId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  slotInterval = 15;
}

export class AvailabilityCalendarQueryDto {
  @IsUUID()
  barberProfileId!: string;

  @IsUUID()
  barberServiceId!: string;

  @Matches(/^\d{4}-\d{2}$/)
  month!: string;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  slotInterval = 15;
}
