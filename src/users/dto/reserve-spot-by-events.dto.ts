import {
  IsString,
  IsEmail,
  IsArray,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { TicketKind } from '../../spots/dto/enum';
import { UserType, Gender } from './enum';

export class ReserveSpotDto {
  @IsString()
  eventId: string;

  @IsArray()
  @IsString({ each: true })
  spots: string[];

  @IsEnum(TicketKind)
  ticket_kind: TicketKind;

  @IsEmail()
  email: string;

  @IsEnum(UserType)
  userType: UserType;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
