import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpotsModule } from './spots/spots.module';
import { EventsModule } from './events/events.module';
import { FirebaseModule } from './firebase/firebase.module';

@Module({
  imports: [FirebaseModule, SpotsModule, EventsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
