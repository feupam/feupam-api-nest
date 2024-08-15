import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsNumberString,
  IsISO8601,
  IsNumber,
} from 'class-validator';
import { EventType } from './enum'; // Ajuste o caminho conforme necessário

export class CreateEventDto {
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsString()
  @IsNotEmpty()
  name: string;

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
}
