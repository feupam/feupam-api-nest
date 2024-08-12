import { PartialType } from '@nestjs/mapped-types';
import { ChargeDto } from './create-payment.dto';

export class UpdatePaymentDto extends PartialType(ChargeDto) {}
