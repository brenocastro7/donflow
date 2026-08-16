import {
  IsEmail,
  Equals,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  STRONG_PASSWORD_MESSAGE,
  STRONG_PASSWORD_PATTERN,
} from '../password-policy';

export class RegisterCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'O telemóvel deve estar no formato internacional E.164.',
  })
  phone?: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72)
  @Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE })
  password!: string;

  @Equals(true, {
    message: 'É necessário autorizar o envio de e-mails transacionais.',
  })
  transactionalEmailConsent!: boolean;
}
