import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { RedisService } from '../redis/redis.service';

@Module({
  imports: [FirebaseModule],
  controllers: [PaymentController],
  providers: [PaymentService, RedisService],
})
export class PaymentModule {}