import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CuponsService } from './cupons.service';
import { CuponsController } from './cupons.controller';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { AuthMiddleware } from 'src/firebase/auth.middleware';
import { PaymentController } from 'src/payment/payment.controller';

@Module({
  imports: [FirebaseModule],
  controllers: [CuponsController],
  providers: [CuponsService],
})
export class CuponsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(PaymentController);
  }
}
