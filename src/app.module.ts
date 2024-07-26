import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpotsModule } from './spots/spots.module';
import { EventsModule } from './events/events.module';
import { FirebaseModule } from './firebase/firebase.module';
import { UsersModule } from './users/users.module';
import { StaffModule } from './staff/staff.module';

@Module({
  imports: [FirebaseModule, SpotsModule, EventsModule, UsersModule, StaffModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
