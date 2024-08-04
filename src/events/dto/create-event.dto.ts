// src/events/dto/create-event.dto.ts

import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { EventType } from './enum';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsDateString()
  date: string;

  @IsEnum(EventType)
  eventType: EventType; // Pode ser gender_specific ou general

  @IsOptional()
  @IsNumber()
  maxClientMale?: number; // Máximo de vagas para clientes masculinos, se aplicável

  @IsOptional()
  @IsNumber()
  maxClientFemale?: number; // Máximo de vagas para clientes femininos, se aplicável

  @IsOptional()
  @IsNumber()
  maxStaffMale?: number; // Máximo de vagas para staff masculinos, se aplicável

  @IsOptional()
  @IsNumber()
  maxStaffFemale?: number; // Máximo de vagas para staff femininos, se aplicável
  maxGeneralSpots: number;
  location: any;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
