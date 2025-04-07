import { RedisService } from './redis.service';

export class ScheduledUnlockService {
  constructor(private readonly redisService: RedisService) {}

  async handleUnlockQueue(): Promise<void> {
    const eventKeys = await this.redisService.getQueue('event_keys');
    for (const eventId of eventKeys) {
      const queueKey = `queue:${eventId}`;
      const reservationKey = `reservations:${eventId}`;
      const currentReservations = parseInt(await this.redisService.get(reservationKey) || '0', 10);

      if (currentReservations < 200) {
        const toUnlock = 5;
        const unlocked: string[] = [];

        for (let i = 0; i < toUnlock; i++) {
          const email = await this.redisService.dequeue(queueKey);
          if (!email) break;

          unlocked.push(email);
        }

        // atualiza contagem
        await this.redisService.set(reservationKey, (currentReservations + unlocked.length).toString(), 60 * 15);

        console.log(`[CRON] Desbloqueando usuários para o evento ${eventId}:`, unlocked);
      }
    }
  }
}
