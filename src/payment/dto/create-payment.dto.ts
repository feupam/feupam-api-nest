import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEmail,
  IsBoolean,
  ValidateNested,
  IsArray,
  IsOptional,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class CustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}

class ItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  @IsNotEmpty()
  unit_price: number;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsBoolean()
  @IsNotEmpty()
  tangible: boolean;
}

class AddressDto {
  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  neighborhood: string;

  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  street_number: string;

  @IsString()
  @IsNotEmpty()
  zipcode: string;
}

class BillingDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}

class PaymentDataDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsIn(['credit_card', 'boleto', 'pix'])
  payment_method: string;

  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => ItemDto)
  items: ItemDto[];

  @ValidateNested()
  @Type(() => BillingDto)
  billing: BillingDto;

  @IsString()
  @IsNotEmpty()
  card_number: string;

  @IsString()
  @IsNotEmpty()
  card_cvv: string;

  @IsString()
  @IsNotEmpty()
  card_expiration_date: string;

  @IsString()
  @IsNotEmpty()
  card_holder_name: string;
}

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  reservationId: string;

  @ValidateNested()
  @Type(() => PaymentDataDto)
  paymentData: PaymentDataDto;
}

export class ChargeDto {
  @IsString()
  @IsNotEmpty()
  event: string;

  @IsString()
  @IsNotEmpty()
  chargeId: string;

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

  @IsString()
  @IsNotEmpty()
  userID: string;

  @IsNumber()
  @IsNotEmpty()
  lote: number;

  @IsBoolean()
  @IsNotEmpty()
  envioWhatsapp: boolean;
}
