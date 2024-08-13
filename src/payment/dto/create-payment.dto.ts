import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEmail,
  ValidateNested,
  IsArray,
  IsOptional,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString()
  @IsNotEmpty()
  line_1: string;

  @IsString()
  @IsOptional()
  line_2?: string;

  @IsString()
  @IsNotEmpty()
  zip_code: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  country: string;
}

class MobilePhoneDto {
  @IsString()
  @IsNotEmpty()
  country_code: string;

  @IsString()
  @IsNotEmpty()
  area_code: string;

  @IsString()
  @IsNotEmpty()
  number: string;
}

class CustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  document: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @ValidateNested()
  @Type(() => MobilePhoneDto)
  phones: { mobile_phone: MobilePhoneDto };
}

class ItemDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsNumber()
  @IsNotEmpty()
  code: number;
}

class BillingAddressDto {
  @IsString()
  @IsNotEmpty()
  line_1: string;

  @IsString()
  @IsOptional()
  line_2?: string;

  @IsString()
  @IsNotEmpty()
  zip_code: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  country: string;
}

class CardDto {
  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @IsNotEmpty()
  holder_name: string;

  @IsNumber()
  @IsNotEmpty()
  exp_month: number;

  @IsNumber()
  @IsNotEmpty()
  exp_year: number;

  @IsString()
  @IsNotEmpty()
  cvv: string;

  @ValidateNested()
  @Type(() => BillingAddressDto)
  billing_address: BillingAddressDto;
}

class CreditCardDto {
  @IsBoolean()
  recurrence: boolean;

  @IsNumber()
  @IsNotEmpty()
  installments: number;

  @IsString()
  @IsNotEmpty()
  statement_descriptor: string;

  @ValidateNested()
  @Type(() => CardDto)
  card: CardDto;
}

class BoletoDto {
  @IsString()
  @IsNotEmpty()
  instructions: string;

  @IsString()
  @IsNotEmpty()
  due_at: string;

  @IsString()
  @IsNotEmpty()
  document_number: string;

  @IsString()
  @IsNotEmpty()
  type: string;
}

class PixDto {
  @IsString()
  @IsNotEmpty()
  expires_in: string;
}

class PaymentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['credit_card', 'boleto', 'pix'])
  payment_method: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => CreditCardDto)
  credit_card?: CreditCardDto;

  @ValidateNested()
  @IsOptional()
  @Type(() => BoletoDto)
  boleto?: BoletoDto;

  @ValidateNested()
  @IsOptional()
  @Type(() => PixDto)
  pix?: PixDto;
}

export class CreatePaymentDto {
  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => ItemDto)
  items: ItemDto[];

  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => PaymentDto)
  payments: PaymentDto[];
}

export class ChargeDto {
  @IsString()
  @IsNotEmpty()
  chargeId: string;

  @IsString()
  @IsNotEmpty()
  event: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  payLink: string;

  @IsString()
  @IsOptional()
  qrcodePix: string;

  @IsString()
  @IsNotEmpty()
  meio: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNumber()
  @IsNotEmpty()
  lote: number;

  @IsBoolean()
  @IsNotEmpty()
  envioWhatsapp: boolean;
}
