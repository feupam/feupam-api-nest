import * as functions from 'firebase-functions';
import { RedisService } from '../src/redis/redis.service';
import { ScheduledUnlockService } from '../src/redis/scheduled-unlock.service';
import * as dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

const redisService = new RedisService();
const unlockService = new ScheduledUnlockService(redisService);

export const unlockQueue = functions.pubsub
  .schedule('every 1 minutes') // você pode ajustar a frequência
  .timeZone('America/Sao_Paulo') // ajuste para seu fuso
  .onRun(async () => {
    console.log('[CRON] Liberando fila de espera...');
    await unlockService.handleUnlockQueue();
  });
