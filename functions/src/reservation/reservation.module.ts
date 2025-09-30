import { Module } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { QueueProcessorService } from './queue-processor.service';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  providers: [ReservationService, QueueProcessorService],
  exports: [ReservationService],
})
export class ReservationModule {}
