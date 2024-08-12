import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CuponsService } from './cupons.service';
import { CuponsController } from './cupons.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { AuthMiddleware } from '../firebase/auth.middleware';

@Module({
  imports: [FirebaseModule],
  controllers: [CuponsController],
  providers: [CuponsService],
})
export class CuponsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(CuponsController);
  }
}
