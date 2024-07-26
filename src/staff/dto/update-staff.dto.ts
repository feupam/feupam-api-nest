import { IsString, IsOptional, IsEnum } from 'class-validator';
import { SpotType } from '../../spots/dto/enum'; // Certifique-se de que o enum SpotType esteja no local correto

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(SpotType)
  spotType?: SpotType;

  @IsOptional()
  @IsString()
  eventId?: string;
}
