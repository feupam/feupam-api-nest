import { TicketKind } from '@prisma/client';

export class ReserveSpotDto {
  spots: string[];
  ticket_kind: TicketKind;
  email: string;
}
