import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { AuthMiddleware } from '../firebase/auth.middleware';

@Module({
  imports: [FirebaseModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(CommentsController);
  }
}
