import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { StaffPassService } from './staff-pass.service';
import { StaffPassController } from './staff-pass.controller';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { AuthMiddleware } from 'src/firebase/auth.middleware';
import { PaymentController } from 'src/payment/payment.controller';

@Module({
  imports: [FirebaseModule],
  controllers: [StaffPassController],
  providers: [StaffPassService],
})
export class StaffPassModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(PaymentController);
  }
}
