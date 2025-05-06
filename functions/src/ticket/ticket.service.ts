import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { FirestoreService } from '../firebase/firebase.service';

@Injectable()
export class TicketService {
  private readonly maxSpots = 250;

  constructor(
    private readonly redisService: RedisService,
    private readonly firestoreService: FirestoreService,
  ) {}

  async purchaseTicket(eventId: string, email: string) {
    const reservationKey = `reservation:${email}:${eventId}`;
    const countKey = `event:${eventId}:count`;
    const queueKey = `event:${eventId}:queue`;

    const hasReservation = await this.redisService.get(reservationKey);
    if (hasReservation) {
      const ttl = await this.redisService.ttl(reservationKey);
      return {
        status: 'reserved',
        message: `Você já possui uma reserva ativa. Tempo restante: ${Math.ceil(ttl / 60)} minutos.`,
      };
    }

    const snapshot = await this.firestoreService.firestore
      .collection('reservationHistory')
      .where('email', '==', email)
      .where('eventId', '==', eventId)
      .where('status', '==', "available")
      .get();

    if (snapshot.empty) {
      throw new Error('Reserva não encontrada para este email e evento ou status não é valido.');
    }

    const pagosSnapshot = await this.firestoreService.firestore
      .collection('reservationHistory')
      .where('eventId', '==', eventId)
      .where('status', '==', 'Pago')
      .get();

    const paidCount = pagosSnapshot.size;

    if (paidCount >= this.maxSpots) {
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

    const count = await this.redisService.incr(countKey);

    if (count <= this.maxSpots) {
      const currentDate = new Date();
      await this.redisService.set(reservationKey, { "fifo": count.toString(), "expire": currentDate.toISOString(), "status": "reserved" });

      snapshot.forEach(async (doc) => {
        await doc.ref.update({
          status: 'reserved',
          updatedAt: new Date(),
        });
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

        const snapshot = await this.firestoreService.firestore
          .collection('reservationHistory')
          .where('email', '==', email)
          .where('eventId', '==', eventId)
          .where('status', 'in', ['available', 'waiting'])
          .get();

        if (!snapshot.empty) {
          snapshot.forEach(async (doc) => {
            await doc.ref.update({
              status: 'waiting',
              updatedAt: new Date(),
            });
          });
        }
      }

      return {
        status: 'queued',
        message: 'Ingressos esgotados. Você foi colocado na fila de espera.',
      };
    }
  }

  async getReservationStatus(eventId: string, email: string) {
    const reservationKey = `reservation:${email}:${eventId}`;

    const exists = await this.redisService.get(reservationKey);

    if (exists) {
      console.log("oi")
      console.log(exists)
      const parsed = JSON.parse(exists)
      console.log(parsed["expire"])
      const expiresAt = new Date(parsed["expire"]);
      const now = new Date();
      const nowISO = now.toISOString();

      const totalGracePeriod = 10 * 60 * 1000; // 10 minutos
      const graceDeadline = expiresAt.getTime() + totalGracePeriod;
      const timeDifference = graceDeadline - now.getTime();
      const expired = timeDifference <= 0;
      const remaining = expired ? 0 : Math.max(0, timeDifference);
      
      parsed["status"] = expired ? 'expired' : 'reserved';
      await this.redisService.set(reservationKey, parsed);
      
      return {
        status: parsed["status"],
        expiresAt: expiresAt.toISOString(),
        currentTime: nowISO,
        remainingMinutes: Math.ceil(remaining / 60000),
      };
    }

    return { status: 'none' };
  }

}
