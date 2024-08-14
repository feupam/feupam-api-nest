import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketKind } from './enum-spot';

export class ReserveSpotDto {
  @IsString()
  @IsOptional()
  eventId: string;

  @IsEnum(TicketKind)
  ticket_kind: TicketKind; // Tipo de ticket
}

export class ReservedDto {
  spotId: string;
  ticketKind: TicketKind;
  email: string;
  eventId: string;
  userId: string;
}
