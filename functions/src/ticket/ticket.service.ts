import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { FirestoreService } from '../firebase/firebase.service';


@Injectable()
export class TicketService {
  private readonly maxSpots = 200;
  private readonly releaseBatch = 5;
  private readonly reservationTTL = 600; // 10 minutes in seconds

  constructor(
    private readonly redisService: RedisService,
    private readonly firestoreService: FirestoreService,
  ) {}

  async purchaseTicket(eventId: string, email: string) {
    const reservationKey = `reservation:${email}:${eventId}`;
    const countKey = `event:${eventId}:count`;
    const queueKey = `event:${eventId}:queue`;

    // Check if user already has reservation
    const hasReservation = await this.redisService.get(reservationKey);
    if (hasReservation) {
      return { status: 'reserved', message: 'Você já possui uma reserva ativa para esse evento.' };
    }
    const count = await this.redisService.incr(countKey);

    if (count <= this.maxSpots) {
      // Grant reservation and set TTL
      await this.redisService.set(reservationKey, '1', this.reservationTTL);

      await this.firestoreService.firestore.collection('reservationHistory').add({
        email,
        eventId,
        price: 7000, // valor do ingresso
        status: 'Reservado',
        createdAt: new Date(),
      });
  
      return {
        status: 'reserved',
        message: 'Reserva efetuada com sucesso. Você tem 10 minutos para completar o pagamento.',
      };
    } else {
      // Rollback increment
      await this.redisService.decr(countKey);

      // Add to queue if not already present
      const queue = await this.redisService.getQueue(queueKey);
      if (!queue.includes(email)) {
        await this.redisService.enqueue(queueKey, email);
      }

      return { status: 'queued', message: 'Ingressos esgotados. Você foi colocado na fila de espera.' };
    }
  }

  async releaseSpots(eventId: string) {
    const countKey = `event:${eventId}:count`;
    const queueKey = `event:${eventId}:queue`;

    const currentCount = parseInt(await this.redisService.get(countKey)) || 0;

    if (currentCount < this.maxSpots) {
      const queue = await this.redisService.getQueue(queueKey);
      const slotsAvailable = this.maxSpots - currentCount;
      const toRelease = Math.min(slotsAvailable, this.releaseBatch, queue.length);

      for (let i = 0; i < toRelease; i++) {
        const email = await this.redisService.dequeue(queueKey);
        if (email) {
          const reservationKey = `reservation:${email}:${eventId}`;
          await this.redisService.set(reservationKey, '1', this.reservationTTL);
          await this.redisService.incr(countKey);
          // aqui você pode enviar notificação por email/whatsapp avisando
        }
      }
    }
  }
}
