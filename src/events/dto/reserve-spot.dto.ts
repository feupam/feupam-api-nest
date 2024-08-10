import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TicketKind } from './enum-spot';
import { UserType, Gender } from './enum';

export class ReserveSpotDto {
  @IsString()
  @IsOptional()
  eventId: string;

  @IsString()
  @IsOptional()
  userId: string;

  @IsArray()
  @IsString({ each: true })
  spots: string[]; // IDs dos spots a serem reservados

  @IsEnum(TicketKind)
  ticket_kind: TicketKind; // Tipo de ticket

  @IsString()
  email: string; // Email do usuário

  @IsEnum(UserType)
  userType: UserType; // Tipo de usuário (client ou staff)

  @IsNotEmpty()
  @IsEnum(Gender)
  gender?: Gender; // Gênero do usuário (opcional, necessário para eventos gender_specific)
}

export class ReservedDto {
  spotId: string;
  ticketKind: TicketKind;
  email: string;
  eventId: string;
  userId: string;
}
