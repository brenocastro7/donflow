import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { BarbersService } from './barbers.service';
import { CompleteBarberInvitationDto } from './dto/barber-invitation.dto';

@Controller('barber-invitations')
export class BarberInvitationsController {
  constructor(private readonly barbersService: BarbersService) {}

  @Post('complete')
  @Public()
  complete(@Body() dto: CompleteBarberInvitationDto) {
    return this.barbersService.completeInvitation(dto);
  }
}
