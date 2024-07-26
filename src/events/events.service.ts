import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FirestoreService } from '../firebase/firebase.service'; // Assumindo que você tem um serviço FirestoreService configurado
import { ReserveSpotDto } from './dto/reserve-spot.dto';
import { SpotStatus, TicketStatus } from '../spots/dto/enum'; // Defina seus enums SpotStatus e TicketStatus
import { UsersService } from '../users/users.service'; // Serviço de usuários

@Injectable()
export class EventsService {
  constructor(
    private firestoreService: FirestoreService,
    private usersService: UsersService,
  ) {}

  async create(createEventDto: CreateEventDto) {
    const eventRef = this.firestoreService.firestore.collection('events').doc();
    await eventRef.set({
      ...createEventDto,
      date: new Date(createEventDto.date),
    });
    return { id: eventRef.id, ...createEventDto };
  }

  async findAll() {
    const snapshot = await this.firestoreService.firestore
      .collection('events')
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findOne(id: string) {
    const eventRef = this.firestoreService.firestore
      .collection('events')
      .doc(id);
    const doc = await eventRef.get();
    if (!doc.exists) {
      throw new Error('Event not found');
    }
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, updateEventDto: UpdateEventDto) {
    const eventRef = this.firestoreService.firestore
      .collection('events')
      .doc(id);
    await eventRef.update({
      ...updateEventDto,
      date: new Date(updateEventDto.date),
    });
    return { id, ...updateEventDto };
  }

  async remove(id: string) {
    const eventRef = this.firestoreService.firestore
      .collection('events')
      .doc(id);
    await eventRef.delete();
    return { id };
  }

  async reserveSpot(dto: ReserveSpotDto & { eventId: string; userId: string }) {
    const firestore = this.firestoreService.getFirestore();

    try {
      return await firestore.runTransaction(async (transaction) => {
        // Obter os spots disponíveis para o evento e verificar se todos existem
        const spotsSnapshot = await transaction.get(
          firestore
            .collection('spots')
            .where('eventId', '==', dto.eventId)
            .where('name', 'in', dto.spots),
        );

        const spots = spotsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        if (spots.length !== dto.spots.length) {
          const foundSpotsName = spots.map((spot) => spot.id);
          const notFoundSpotsName = dto.spots.filter(
            (spotName) => !foundSpotsName.includes(spotName),
          );
          throw new Error(`Spots ${notFoundSpotsName.join(', ')} not found`);
        }

        // Verificar se o usuário já tem uma reserva para o evento
        const userReservations = await transaction.get(
          firestore
            .collection('reservationHistory')
            .where(
              'spotId',
              'in',
              spots.map((spot) => spot.id),
            )
            .where('userId', '==', dto.userId),
        );

        if (!userReservations.empty) {
          throw new Error(
            'User already has a reservation for one of the requested spots',
          );
        }

        // Atualizar a reserva e o status dos spots
        const batch = firestore.batch();
        const ticketRefs = [];

        spots.forEach((spot) => {
          const reservationHistoryRef = firestore
            .collection('reservationHistory')
            .doc();
          batch.set(reservationHistoryRef, {
            spotId: spot.id,
            ticketKind: dto.ticket_kind,
            email: dto.email,
            status: TicketStatus.reserved,
            userId: dto.userId,
          });

          const spotRef = firestore.collection('spots').doc(spot.id);
          batch.update(spotRef, { status: SpotStatus.reserved });

          const ticketRef = firestore.collection('tickets').doc();
          ticketRefs.push(ticketRef);
          batch.set(ticketRef, {
            spotId: spot.id,
            ticketKind: dto.ticket_kind,
            email: dto.email,
            userId: dto.userId,
          });
        });

        await batch.commit();

        // Retornar os tickets criados
        const tickets = await Promise.all(
          ticketRefs.map((ref) =>
            ref.get().then((doc) => ({ id: doc.id, ...doc.data() })),
          ),
        );

        return tickets;
      });
    } catch (error) {
      console.error('Transaction failed: ', error.message);
      throw new Error(error.message);
    }
  }
}
