import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { FirestoreService } from './firebase.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthMiddleware } from './auth.middleware';
import { UsersController } from 'src/users/users.controller';

@Module({
  imports: [],
  providers: [FirestoreService, AuthService],
  controllers: [AuthController],
  exports: [FirestoreService, AuthService],
})
export class FirebaseModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(UsersController);
  }
}
