import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CustomersService } from './customers.service';
import {
  CustomerAppointmentsQueryDto,
  CustomerListQueryDto,
  CustomerPhoneLookupQueryDto,
} from './dto/customer-query.dto';
import { UpdateCustomerBookingBlockDto } from './dto/update-customer-booking-block.dto';

@Controller('customers')
@UseGuards(RolesGuard)
@Roles(UserRole.MASTER)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@Query() query: CustomerListQueryDto) {
    return this.customersService.list(query);
  }

  @Get('lookup')
  @Roles(UserRole.MASTER, UserRole.BARBER)
  lookup(@Query() query: CustomerPhoneLookupQueryDto) {
    return this.customersService.lookupByPhone(query.phone);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.customersService.detail(id);
  }

  @Get(':id/appointments')
  appointments(
    @Param('id') id: string,
    @Query() query: CustomerAppointmentsQueryDto,
  ) {
    return this.customersService.appointments(id, query);
  }

  @Patch(':id/booking-block')
  updateBookingBlock(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerBookingBlockDto,
  ) {
    return this.customersService.updateBookingBlock(id, dto.blocked);
  }
}
