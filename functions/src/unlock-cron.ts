import * as functions from 'firebase-functions';
import { RedisService } from './redis/redis.service';
import { ScheduledUnlockService } from './redis/scheduled-unlock.service';
import * as dotenv from 'dotenv';
dotenv.config();

const redisService = new RedisService();
const unlockService = new ScheduledUnlockService(redisService);

export const unlockQueue = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    console.log('[CRON] Liberando fila de espera...');
    await unlockService.handleUnlockQueue();
  });
