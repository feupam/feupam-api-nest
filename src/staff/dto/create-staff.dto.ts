import { IsString, IsNotEmpty } from 'class-validator';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  email: string;
}
