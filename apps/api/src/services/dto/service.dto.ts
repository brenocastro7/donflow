import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateServiceTemplateDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;
}

export class UpdateServiceTemplateDto extends PartialType(
  CreateServiceTemplateDto,
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBarberServiceDto {
  @IsOptional()
  @IsUUID()
  barberProfileId?: string;

  @IsOptional()
  @IsUUID()
  serviceTemplateId?: string;

  @IsOptional()
  @IsUUID()
  sourceBarberServiceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;
}

export class UpdateBarberServiceDto extends PartialType(
  CreateServiceTemplateDto,
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
