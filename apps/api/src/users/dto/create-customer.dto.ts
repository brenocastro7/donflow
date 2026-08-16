export class CreateCustomerDto {
  name!: string;
  email!: string;
  phone?: string;
  password!: string;
  transactionalEmailConsent!: boolean;
}

export class CreateEmailVerificationDto {
  tokenHash!: string;
  expiresAt!: Date;
}
