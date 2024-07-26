import { IsArray, IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { TicketKind } from '../../spots/dto/enum';

export class ReserveSpotForStaffDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  spots: string[];

  @IsEnum(TicketKind)
  @IsNotEmpty()
  ticket_kind: TicketKind;

  @IsString()
  @IsNotEmpty()
  email: string;
}
