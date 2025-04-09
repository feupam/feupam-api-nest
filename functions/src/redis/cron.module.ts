// functions/src/redis/cron.module.ts
import { Module } from '@nestjs/common';
import { RedisModule } from './redis.module';
import { ScheduledUnlockService } from './scheduled-unlock.service';

@Module({
  imports: [RedisModule],
  providers: [ScheduledUnlockService],
})
export class CronModule {}
