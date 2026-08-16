import {
  Body,
  Controller,
  Delete,
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
import {
  CreateBarberServiceDto,
  CreateServiceTemplateDto,
  UpdateBarberServiceDto,
  UpdateServiceTemplateDto,
} from './dto/service.dto';
import { ServicesService } from './services.service';

@Controller()
@UseGuards(RolesGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post('service-templates')
  @Roles(UserRole.MASTER)
  createTemplate(@Body() dto: CreateServiceTemplateDto) {
    return this.servicesService.createTemplate(dto);
  }

  @Get('service-templates')
  listTemplates() {
    return this.servicesService.listTemplates();
  }

  @Get('master-service-catalog')
  @Roles(UserRole.BARBER, UserRole.MASTER)
  listMasterCatalog() {
    return this.servicesService.listMasterCatalog();
  }

  @Patch('service-templates/:id')
  @Roles(UserRole.MASTER)
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateServiceTemplateDto,
  ) {
    return this.servicesService.updateTemplate(id, dto);
  }

  @Post('barber-services')
  @Roles(UserRole.BARBER, UserRole.MASTER)
  createBarberService(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBarberServiceDto,
  ) {
    return this.servicesService.createBarberService(user, dto);
  }

  @Get('barbers/:barberProfileId/services')
  listBarberServices(
    @CurrentUser() user: AuthenticatedUser,
    @Param('barberProfileId') barberProfileId: string,
    @Query('includeInactive', new ParseBoolPipe({ optional: true }))
    includeInactive = false,
  ) {
    return this.servicesService.listBarberServices(
      user,
      barberProfileId,
      includeInactive,
    );
  }

  @Patch('barber-services/:id')
  @Roles(UserRole.BARBER, UserRole.MASTER)
  updateBarberService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBarberServiceDto,
  ) {
    return this.servicesService.updateBarberService(user, id, dto);
  }

  @Delete('barber-services/:id')
  @Roles(UserRole.BARBER, UserRole.MASTER)
  deleteBarberService(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.servicesService.deleteBarberService(user, id);
  }
}
