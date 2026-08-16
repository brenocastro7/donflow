import { IsBoolean } from 'class-validator';

export class UpdateCustomerBookingBlockDto {
  @IsBoolean()
  blocked!: boolean;
}
