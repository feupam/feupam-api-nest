import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { ReservationModule } from '../reservation/reservation.module';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [ReservationModule, FirebaseModule],
  controllers: [TicketController],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}
