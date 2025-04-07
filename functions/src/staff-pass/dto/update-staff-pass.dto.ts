import { PartialType } from '@nestjs/mapped-types';
import { CreateStaffPassDto } from './create-staff-pass.dto';

export class UpdateStaffPassDto extends PartialType(CreateStaffPassDto) {}
