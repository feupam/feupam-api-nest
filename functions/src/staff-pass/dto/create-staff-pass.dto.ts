import { IsNotEmpty, IsString } from 'class-validator';

export class CreateStaffPassDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  staff_password: string;
}
