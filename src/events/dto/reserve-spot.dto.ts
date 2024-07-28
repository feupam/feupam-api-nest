import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketKind } from '../../spots/dto/enum';
import { UserType, Gender } from './enum';

export class ReserveSpotDto {
  @IsString()
  eventId: string;

  @IsArray()
  @IsString({ each: true })
  spots: string[]; // IDs dos spots a serem reservados

  @IsEnum(TicketKind)
  ticket_kind: TicketKind; // Tipo de ticket

  @IsString()
  email: string; // Email do usuário

  @IsEnum(UserType)
  userType: UserType; // Tipo de usuário (client ou staff)

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender; // Gênero do usuário (opcional, necessário para eventos gender_specific)
}
