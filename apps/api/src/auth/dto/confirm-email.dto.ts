import { IsHexadecimal, IsString, Length } from 'class-validator';

export class ConfirmEmailDto {
  @IsString()
  @IsHexadecimal()
  @Length(64, 64)
  token!: string;
}
