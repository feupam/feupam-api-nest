import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';
import { ReserveSpotDto } from '../events/dto/reserve-spot.dto';
import { SpotStatus, TicketStatus } from '../spots/dto/enum';

@Injectable()
export class UsersService {
  constructor(private firestoreService: FirestoreService) {}

  async reserveSpot(userId: string, dto: ReserveSpotDto) {
    const firestore = this.firestoreService.getFirestore();

    try {
      return await firestore.runTransaction(async (transaction) => {
        // Verifique se o evento existe
        const eventRef = firestore.collection('events').doc(dto.eventId);
        const eventDoc = await transaction.get(eventRef);
        if (!eventDoc.exists) {
          throw new Error('Event not found');
        }

        // Verifique se os spots existem e estão disponíveis
        const spotsQuery = firestore
          .collection('spots')
          .where('eventId', '==', dto.eventId)
          .where('name', 'in', dto.spots);
        const spotsSnapshot = await transaction.get(spotsQuery);
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

        // Verifique se o usuário já tem uma reserva para o evento
        const userReservationsQuery = firestore
          .collection('reservationHistory')
          .where('userId', '==', userId)
          .where(
            'spotId',
            'in',
            spots.map((spot) => spot.id),
          );
        const userReservationsSnapshot = await transaction.get(
          userReservationsQuery,
        );

        if (!userReservationsSnapshot.empty) {
          throw new Error(
            'User already has a reservation for one of the requested spots',
          );
        }

        // Verifique se o número total de spots não ultrapassa o limite
        const totalSpotsQuery = firestore
          .collection('spots')
          .where('eventId', '==', dto.eventId);
        const totalSpotsSnapshot = await transaction.get(totalSpotsQuery);

        if (totalSpotsSnapshot.size >= 100) {
          throw new Error(
            'The maximum number of spots for this event has been reached',
          );
        }

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
            userId,
          });

          const spotRef = firestore.collection('spots').doc(spot.id);
          batch.update(spotRef, { status: SpotStatus.reserved });

          const ticketRef = firestore.collection('tickets').doc();
          ticketRefs.push(ticketRef);
          batch.set(ticketRef, {
            spotId: spot.id,
            ticketKind: dto.ticket_kind,
            email: dto.email,
            userId,
          });
        });

        await batch.commit();

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
