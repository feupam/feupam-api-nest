import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module';
import { FirebaseModule } from './firebase/firebase.module';
import { UsersModule } from './users/users.module';
import { PaymentModule } from './payment/payment.module';
import { ConfigModule } from '@nestjs/config';
import { StaffPassModule } from './staff-pass/staff-pass.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [
    FirebaseModule,
    EventsModule,
    UsersModule,
    PaymentModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CommentsModule,
    StaffPassModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
