import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { FirestoreService } from '../firebase/firebase.service';

@Injectable()
export class TicketService {
  private readonly pagoMax = 173;
  private readonly FMax = 83;
  private readonly MMax = 90;

  constructor(
    private readonly redisService: RedisService,
    private readonly firestoreService: FirestoreService,
  ) {}

  async purchaseTicket(eventId: string, email: string) {
    const reservationKey = `reservation:${email}:${eventId}`;
    const pagoKey = `pago:pagarme:count`;
    const queueKey = `event:${eventId}:queue`;

    const reservationHistory = await this.firestoreService.firestore
      .collection('reservationHistory')
      .where('email', '==', email)
      .where('eventId', '==', eventId)
      .where('status', '==', 'available')
      .get();

    if (reservationHistory.empty) {
      throw new Error('Reserva não encontrada para este email e evento ou status não é válido.');
    }

    const usersRef = await this.firestoreService.firestore
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersRef.empty) {
      throw new Error('Usuário não encontrado.');
    }

    const userData = usersRef.docs[0].data();
    const gender = userData.gender;

    if (!['male', 'female'].includes(gender)) {
      throw new Error('Gênero não especificado corretamente no perfil do usuário.');
    }

    const maxByGender = gender === 'female' ? this.FMax : this.MMax;
    const countKey = `event:${eventId}:count:${gender}`;
    const queueGenderKey = `${queueKey}:${gender}`;

    const pagoCount = await this.redisService.get(pagoKey);
    if (pagoCount && Number(pagoCount) >= this.pagoMax) {
      const waitingListRef = this.firestoreService.firestore.collection('waitingList').doc(eventId);
      const waitingListDoc = await waitingListRef.get();
      const existingEmails = waitingListDoc.exists ? waitingListDoc.data()?.emails || [] : [];

      if (!existingEmails.includes(email)) {
        await waitingListRef.set(
          { emails: [...existingEmails, email] },
          { merge: true },
        );
      }

      return {
        status: 'waiting-list',
        message: 'Todos os ingressos foram pagos. Você foi adicionado à lista de interessados.',
      };
    }

    const exists = await this.redisService.get(reservationKey);
    let result: any = null;

    if (exists) {
      result = await this.checkReservationStatus(exists, reservationKey, email, eventId);
      if (result.status === 'pago') {
        return {
          status: 'pago',
          message: 'Você já pagou a sua inscrição.',
        };
      }
    }

    if (!exists || (result.status !== 'expired' && result.status !== 'reserved')) {
      const count = await this.redisService.incr(countKey);

      if (count <= maxByGender) {
        const currentDate = new Date();
        await this.redisService.set(reservationKey, {
          fifo: count.toString(),
          expire: currentDate.toISOString(),
          status: 'reserved',
          gender: gender,
        });

        return {
          status: 'reserved',
          message: 'Reserva efetuada com sucesso. Você tem 10 minutos para completar o pagamento.',
        };
      } else {
        await this.redisService.decr(countKey);
        const queue = await this.redisService.getQueue(queueGenderKey);

        if (!queue.includes(email)) {
          await this.redisService.enqueue(queueGenderKey, email);
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
    const pagoCount = Number(await this.redisService.get(pagoKey)) || 0;
    if (pagoCount >= this.pagoMax) return;

    const genders = ['male', 'female'];

    for (const gender of genders) {
      const queueGenderKey = `event:${eventId}:queue:${gender}`;
      const maxByGender = gender === 'female' ? this.FMax : this.MMax;
      const countKey = `event:${eventId}:count:${gender}`;
      const queue = await this.redisService.getQueue(queueGenderKey);

      for (const email of queue) {
        const reservationKey = `reservation:${email}:${eventId}`;
        const exists = await this.redisService.get(reservationKey);

        if (!exists) {
          await this.redisService.dequeue(queueGenderKey);
          continue;
        }

        const result = await this.checkReservationStatus(exists, reservationKey, email, eventId);
        if (result.status === 'expired') {
          await this.redisService.dequeue(queueGenderKey);
          continue;
        }

        if (result.status === 'queued' || result.status === 'waiting-list') {
          const currentCount = await this.redisService.incr(countKey);

          if (currentCount <= maxByGender) {
            const currentDate = new Date();
            await this.redisService.set(reservationKey, {
              fifo: currentCount.toString(),
              expire: currentDate.toISOString(),
              status: 'reserved',
              gender: gender,
            });

            await this.redisService.dequeue(queueGenderKey);
            return;
          } else {
            await this.redisService.decr(countKey);
          }
        }
      }
    }
  }

  async getReservationStatus(eventId: string, email: string) {
    const reservationKey = `reservation:${email}:${eventId}`;
    const exists = await this.redisService.get(reservationKey);

    if (exists) {
      const result = await this.checkReservationStatus(exists, reservationKey, email, eventId);
      return result;
    }

    return { status: 'expired' };
  }

  async checkReservationStatus(
    exists: string,
    reservationKey: string,
    email: string,
    eventId: string,
  ): Promise<{
    status: 'reserved' | 'expired' | 'queued' | 'waiting-list';
    expiresAt: string;
    currentTime: string;
    remainingMinutes: number;
  }> {
    const parsed = JSON.parse(exists);
    const expiresAt = new Date(parsed.expire);
    const now = new Date();
    const graceDeadline = expiresAt.getTime() + 10 * 60 * 1000;
    const timeDifference = graceDeadline - now.getTime();
    const expired = timeDifference <= 0;
    const is_expired = expired ? 'expired' : 'reserved';

    if (expired) {
      await this.redisService.deleteReservationKey(email, eventId);
      await this.redisService.decr(`event:${eventId}:count:${parsed.gender}`);
    }

    return {
      status: is_expired,
      expiresAt: expiresAt.toISOString(),
      currentTime: now.toISOString(),
      remainingMinutes: Math.ceil(Math.max(0, timeDifference) / 60000),
    };
  }
}
