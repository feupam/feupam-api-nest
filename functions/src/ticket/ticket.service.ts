import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { FirestoreService } from '../firebase/firebase.service';

@Injectable()
export class TicketService {
  private readonly maxSpots = 250;
  private readonly reservationTTL = 600; // 10 minutes

  constructor(
    private readonly redisService: RedisService,
    private readonly firestoreService: FirestoreService,
  ) {}

  async purchaseTicket(eventId: string, email: string) {
    const reservationKey = `reservation:${email}:${eventId}`;
    const countKey = `event:${eventId}:count`;
    const queueKey = `event:${eventId}:queue`;
    const expireKey = `expire:${email}:${eventId}`;
  
    const hasReservation = await this.redisService.get(reservationKey);
    if (hasReservation) {
      const ttl = await this.redisService.ttl(reservationKey);
      return {
        status: 'reserved',
        message: `Você já possui uma reserva ativa. Tempo restante: ${Math.ceil(ttl / 60)} minutos.`,
      };
    }
  
    // 🔢 Conta quantos já pagaram
    const pagosSnapshot = await this.firestoreService.firestore
      .collection('reservationHistory')
      .where('eventId', '==', eventId)
      .where('status', '==', 'Pago')
      .get();
  
    const paidCount = pagosSnapshot.size;
  
    if (paidCount >= this.maxSpots) {
      // ✅ Já atingiu o limite de pagamentos — entra na waiting list
      const waitingListRef = this.firestoreService.firestore.collection('waitingList').doc(eventId);
      const waitingListDoc = await waitingListRef.get();
      const existingEmails = waitingListDoc.exists ? waitingListDoc.data()?.emails || [] : [];
  
      if (!existingEmails.includes(email)) {
        await waitingListRef.set(
          { emails: [...existingEmails, email] },
          { merge: true }
        );
      }
  
      return {
        status: 'waitingList',
        message: 'Todos os ingressos foram pagos. Você foi adicionado à lista de interessados.',
      };
    }
  
    // Continua com a lógica de fila/reserva no Redis
    const count = await this.redisService.incr(countKey);
    if (count <= this.maxSpots) {
      await this.redisService.set(reservationKey, '1', this.reservationTTL);
      await this.redisService.hset(expireKey, 'expiresAt', (Date.now() + this.reservationTTL * 1000).toString());

      await this.firestoreService.firestore.collection('reservationHistory').add({
        email,
        eventId,
        status: 'reserved',
        createdAt: new Date(),
      });
  
      return {
        status: 'reserved',
        message: 'Reserva efetuada com sucesso. Você tem 10 minutos para completar o pagamento.',
      };
    } else {
      await this.redisService.decr(countKey);
  
      const queue = await this.redisService.getQueue(queueKey);
      if (!queue.includes(email)) {
        await this.redisService.enqueue(queueKey, email);
  
        await this.firestoreService.firestore.collection('reservationHistory').add({
          email,
          eventId,
          status: 'waiting',
          createdAt: new Date(),
        });
      }
  
      return {
        status: 'queued',
        message: 'Ingressos esgotados. Você foi colocado na fila de espera.',
      };
    }
  }  

  async getReservationStatus(eventId: string, email: string) {
    const reservationKey = `reservation:${email}:${eventId}`;
    const expireKey = `expire:${email}:${eventId}`;

    const exists = await this.redisService.get(reservationKey);
    if (exists) {
      const data = await this.redisService.hgetall(expireKey);
      const expiresAt = parseInt(data?.expiresAt || '0');
      const remaining = Math.max(0, expiresAt - Date.now());
      return {
        status: 'reserved',
        remainingMinutes: Math.ceil(remaining / 60000),
      };
    } else {
      return { status: 'none' };
    }
  }

  async cancelAndPromote(eventId: string, email: string) {
    const countKey = `event:${eventId}:count`;
    const queueKey = `event:${eventId}:queue`;
    const expireKey = `expire:${email}:${eventId}`;

    await this.redisService.deleteReservationKey(email, eventId);
    await this.redisService.hdel(expireKey);
    await this.redisService.decr(countKey);

    // Marca como cancelado no histórico
    await this.firestoreService.firestore.collection('reservationHistory').add({
      email,
      eventId,
      status: 'cancelled', // status oficial
      createdAt: new Date(),
    });

    const nextEmail = await this.redisService.dequeue(queueKey);
    if (nextEmail) {
      const newReservationKey = `reservation:${nextEmail}:${eventId}`;
      //const newExpireKey = `expire:${nextEmail}:${eventId}`;

      await this.redisService.set(newReservationKey, '1', this.reservationTTL);
      await this.redisService.incr(countKey);
      await this.redisService.hset(expireKey, 'expiresAt', (Date.now() + this.reservationTTL * 1000).toString());

      // Promovido da fila para reservado
      await this.firestoreService.firestore.collection('reservationHistory').add({
        email: nextEmail,
        eventId,
        status: 'reserved', // status oficial
        createdAt: new Date(),
      });
    }
  }
}
