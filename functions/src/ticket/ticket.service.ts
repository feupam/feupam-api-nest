import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { FirestoreService } from '../firebase/firebase.service';

@Injectable()
export class TicketService {
  private readonly maxSpots = 250;
  private readonly pagoMax = 250;

  constructor(
    private readonly redisService: RedisService,
    private readonly firestoreService: FirestoreService,
  ) {}

  async purchaseTicket(eventId: string, email: string) {
    const reservationKey = `reservation:${email}:${eventId}`;
    const countKey = `event:${eventId}:count`;
    const pagoKey = `pago:pagarme:count`;
    const queueKey = `event:${eventId}:queue`;

    const reservationHistory = await this.firestoreService.firestore
      .collection('reservationHistory')
      .where('email', '==', email)
      .where('eventId', '==', eventId)
      .where('status', '==', "available")
      .get();

    if (reservationHistory.empty) {
      throw new Error('Reserva não encontrada para este email e evento ou status não é valido.');
    }

    const pagoCount = await this.redisService.get(pagoKey);
    if (pagoCount) {
      if (Number(pagoCount) >= this.pagoMax) {
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
          status: 'waiting-list',
          message: 'Todos os ingressos foram pagos. Você foi adicionado à lista de interessados.',
        };
      }
    }

    const exists = await this.redisService.get(reservationKey);
    let result: any = null;

    if (exists) {
      result = await this.checkReservationStatus(exists, reservationKey);
      if (result["status"] === "pago") {
        return {
          status: result["status"],
          message: 'Você já pagou a sua inscrição.',
        };
      }
    }

    if (!exists || (result["status"] !== "expired" && result["status"] !== "reserved")) {
      const count = await this.redisService.incr(countKey);

      if (count <= this.maxSpots) {
        const currentDate = new Date();
        await this.redisService.set(reservationKey, { "fifo": count.toString(), "expire": currentDate.toISOString(), "status": "reserved" });

        return {
          status: 'reserved',
          message: 'Reserva efetuada com sucesso. Você tem 10 minutos para completar o pagamento.',
        };
      } else {
        await this.redisService.decr(countKey);

        const queue = await this.redisService.getQueue(queueKey);

        if (!queue.includes(email)) {
          await this.redisService.enqueue(queueKey, email);
        }

        return {
          status: 'queued',
          message: 'Aguarde ser chamado.',
        };
      }
    }

    return {
      status: result?.status || 'unknown',
      message: 'Você já possui uma reserva ativa ou expirada para esse evento.',
    };
  }

  async processQueue(eventId: string) {
    const pagoKey = `pago:pagarme:count`;
    const queueKey = `event:${eventId}:queue`;
    const pagoCount = Number(await this.redisService.get(pagoKey)) || 0;

    if (pagoCount >= this.pagoMax) return;

    const queue = await this.redisService.getQueue(queueKey);
    for (const email of queue) {
      const reservationKey = `reservation:${email}:${eventId}`;
      const exists = await this.redisService.get(reservationKey);
      if (!exists) {
        await this.redisService.dequeue(queueKey);
        continue;
      }

      let result: { status: 'reserved' | 'queued' | 'waiting-list' | 'expired' | 'pago' | 'unknown' } | null = null;
      result = await this.checkReservationStatus(exists, reservationKey);
      if (result.status === 'expired') {
        await this.redisService.dequeue(queueKey);
        continue;
      }

      if (result.status === 'queued' || result.status === 'waiting-list') {
        const countKey = `event:${eventId}:count`;
        const count = await this.redisService.incr(countKey);

        if (count <= this.maxSpots) {
          const currentDate = new Date();
          await this.redisService.set(reservationKey, {
            fifo: count.toString(),
            expire: currentDate.toISOString(),
            status: "reserved",
          });

          await this.redisService.dequeue(queueKey);
          break; // libera só um por chamada
        } else {
          await this.redisService.decr(countKey);
        }
      }
    }
  }

  async getReservationStatus(eventId: string, email: string) {
    const reservationKey = `reservation:${email}:${eventId}`;

    const exists = await this.redisService.get(reservationKey);

    if (exists) {
      const result = await this.checkReservationStatus(exists, reservationKey);
      return result
    }

    return { status: 'none' };
  }

  async checkReservationStatus(exists: string, reservationKey: string): Promise<{
    status: 'reserved' | 'expired';
    expiresAt: string;
    currentTime: string;
    remainingMinutes: number;
  }> {
    const parsed = JSON.parse(exists);
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

}
