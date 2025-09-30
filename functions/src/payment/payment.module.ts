import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { ReservationModule } from '../reservation/reservation.module';
import { TicketModule } from '../ticket/ticket.module';

@Module({
  imports: [ReservationModule, FirebaseModule, TicketModule],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}