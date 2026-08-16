import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
@UseGuards(RolesGuard)
@Roles(UserRole.CUSTOMER)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user.id, dto);
  }
  @Get('me')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.reviews.listMine(user.id);
  }
}
