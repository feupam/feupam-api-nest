import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { AuthMiddleware } from 'src/firebase/auth.middleware';
import { PaymentController } from 'src/payment/payment.controller';

@Module({
  imports: [FirebaseModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(PaymentController);
  }
}
