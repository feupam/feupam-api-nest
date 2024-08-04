import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Validate,
} from 'class-validator';
import { cpf } from 'cpf-cnpj-validator';
import { Gender, UserType } from './enum';

export class IsCpfValid {
  validate(num: string): boolean {
    return cpf.isValid(num);
  }

  defaultMessage(): string {
    return 'Invalid CPF';
  }
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Validate(IsCpfValid)
  cpf: string;

  @IsEnum(UserType)
  userType: UserType;

  @IsEnum(Gender)
  gender: Gender;
}
