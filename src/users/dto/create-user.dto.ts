import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
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

  @IsString()
  @IsNotEmpty()
  church: string;

  @IsString()
  @IsNotEmpty()
  pastor: string;

  @IsString()
  @IsNotEmpty()
  data_nasc: string;

  @IsNumber()
  @IsNotEmpty()
  idade: number;

  @IsString()
  @IsNotEmpty()
  responsavel: string;

  @IsString()
  @IsNotEmpty()
  documento_responsavel: string;

  @IsString()
  @IsNotEmpty()
  ddd_responsavel: string;

  @IsString()
  @IsNotEmpty()
  cellphone_responsavel: string;

  @IsString()
  @IsNotEmpty()
  alergia: string;

  @IsString()
  @IsNotEmpty()
  medicamento: string;

  @IsString()
  @IsNotEmpty()
  info_add: string;

  @IsEmail()
  @IsOptional()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Validate(IsCpfValid)
  cpf: string;

  @IsEnum(UserType)
  userType: UserType;

  @IsEnum(Gender)
  gender: Gender;

  @IsString()
  @IsNotEmpty()
  address: any;

  @IsString()
  @IsOptional()
  complemento: any;

  @IsString()
  @IsNotEmpty()
  cep: any;

  @IsString()
  @IsNotEmpty()
  cidade: any;

  @IsString()
  @IsNotEmpty()
  estado: any;

  @IsString()
  @IsNotEmpty()
  ddd: any;

  @IsString()
  @IsNotEmpty()
  cellphone: any;
}
