import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEmail,
  ValidateNested,
  IsArray,
  IsOptional,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class CustomerDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

class ItemDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  description: string;
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
  due_at: string;
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
}

export class ReqPaymentDto {
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
  payments: PaymentDto;
}
