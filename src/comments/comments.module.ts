import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { AuthMiddleware } from 'src/firebase/auth.middleware';
import { PaymentController } from 'src/payment/payment.controller';

@Module({
  imports: [FirebaseModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(PaymentController);
  }
}
