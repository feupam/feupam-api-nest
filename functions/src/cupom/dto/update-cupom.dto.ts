import { PartialType } from '@nestjs/mapped-types';
import { CreateCupomDto } from './create-cupom.dto';

export class UpdateCupomDto extends PartialType(CreateCupomDto) {}
