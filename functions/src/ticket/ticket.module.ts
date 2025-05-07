import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { RedisModule } from '../redis/redis.module';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [RedisModule, FirebaseModule],
  controllers: [TicketController],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}
