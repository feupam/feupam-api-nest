import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketKind } from './enum-spot';
import { UserType } from './enum';

export class ReserveSpotDto {
  @IsString()
  @IsOptional()
  eventId: string;

  @IsEnum(TicketKind)
  ticket_kind: TicketKind;

  @IsEnum(UserType)
  userType
}

export class ReservedDto {
  spotId: string;
  ticketKind: TicketKind;
  email: string;
  eventId: string;
  userId: string;
}
