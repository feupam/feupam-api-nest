import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { AuthMiddleware } from 'src/firebase/auth.middleware';

@Module({
  imports: [FirebaseModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(EventsController);
  }
}
