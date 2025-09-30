import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { ReservationModule } from '../reservation/reservation.module';

@Module({
  imports: [FirebaseModule, ReservationModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
