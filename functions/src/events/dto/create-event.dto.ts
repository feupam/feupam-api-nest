import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsNumberString,
  IsISO8601,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { EventType } from './enum';
import { Transform } from 'class-transformer';

export class CreateEventDto {
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsISO8601()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsEnum(EventType)
  @IsNotEmpty()
  eventType: EventType;

  @IsNotEmpty()
  @IsNumberString()
  maxClientMale?: string;

  @IsNotEmpty()
  @IsNumberString()
  maxClientFemale?: string;

  @IsNotEmpty()
  @IsNumberString()
  maxStaffMale?: string;

  @IsNotEmpty()
  @IsNumberString()
  maxStaffFemale?: string;

  @IsNotEmpty()
  @IsNumberString()
  maxGeneralSpots: string;

  @IsISO8601()
  @IsNotEmpty()
  startDate: string;

  @IsISO8601()
  @IsNotEmpty()
  endDate: string;

  @IsOptional()
  @IsString()
  image_capa?: string;

  @IsOptional()
  @IsString()
  logo_evento?: string;
}
