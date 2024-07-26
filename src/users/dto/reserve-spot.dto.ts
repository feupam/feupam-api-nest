import { IsArray, IsEnum, IsString, IsEmail } from 'class-validator';
import { TicketKind } from '../../spots/dto/enum';

export class ReserveSpotDto {
  @IsArray()
  @IsString({ each: true })
  spots: string[]; // Nomes dos spots a serem reservados

  @IsEnum(TicketKind)
  ticket_kind: TicketKind;

  @IsEmail()
  email: string;

  @IsString()
  eventId: string; // Adicionado para identificar o evento
}
