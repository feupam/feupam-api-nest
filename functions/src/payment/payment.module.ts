import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { RedisService } from '../redis/redis.service';
import { RedisModule } from '../redis/redis.module';
import { TicketModule } from 'src/ticket/ticket.module';

@Module({
  imports: [RedisModule, FirebaseModule, TicketModule],
  controllers: [PaymentController],
  providers: [PaymentService, RedisService],
})
export class PaymentModule {}