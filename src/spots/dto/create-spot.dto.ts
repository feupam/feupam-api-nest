import { SpotType } from '../dto/enum';

export class CreateSpotDto {
  name: string;
  eventId: string;
  type: SpotType;
}
