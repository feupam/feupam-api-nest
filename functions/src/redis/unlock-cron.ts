import * as functions from 'firebase-functions';
import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { CronModule } from './cron.module';
import { ScheduledUnlockService } from './scheduled-unlock.service';

dotenv.config();

export const unlockQueue = functions.pubsub
  .schedule('every 1 minutes')
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    const app = await NestFactory.createApplicationContext(CronModule);
    const unlockService = app.get(ScheduledUnlockService);

    console.log('[CRON] Liberando fila de espera...');
    await unlockService.handleUnlockQueue();
    await app.close();
  });
