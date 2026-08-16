import { UserStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateBarberStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
