import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';
import { ReserveSpotDto } from './dto/reserve-spot-by-events.dto';
import { SpotStatus, TicketStatus } from '../spots/dto/enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { EventType, UserType, Gender } from './dto/enum';

@Injectable()
export class UsersService {
  constructor(private firestoreService: FirestoreService) {}

  private userCollection = this.firestoreService.firestore.collection('users');

  async create(createUserDto: CreateUserDto) {
    const userRef = this.firestoreService.firestore.collection('users').doc();
    await userRef.set({
      ...createUserDto,
      createdAt: new Date(),
    });
    return { id: userRef.id, ...createUserDto };
  }

  async findAll() {
    const snapshot = await this.firestoreService.firestore
      .collection('users')
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findOne(id: string) {
    const userRef = this.firestoreService.firestore.collection('users').doc(id);
    const doc = await userRef.get();
    if (!doc.exists) {
      throw new NotFoundException('User not found');
    }
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const userRef = this.firestoreService.firestore.collection('users').doc(id);
    await userRef.update({
      ...updateUserDto,
      updatedAt: new Date(),
    });
    return { id, ...updateUserDto };
  }

  async remove(id: string) {
    const userRef = this.firestoreService.firestore.collection('users').doc(id);
    await userRef.delete();
    return { id };
  }

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

        const eventData = eventDoc.data();
        const eventType = eventData.type as EventType;

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

        const maxSpotsExceeded = (type: UserType, gender?: Gender) => {
          if (eventType === EventType.GENDER_SPECIFIC) {
            if (gender) {
              const genderSpotsQuery = firestore
                .collection('spots')
                .where('eventId', '==', dto.eventId)
                .where('userType', '==', type)
                .where('gender', '==', gender);
              return transaction.get(genderSpotsQuery).then((snapshot) => {
                return (
                  snapshot.size >=
                  eventData[`max${type.toUpperCase()}${gender.toUpperCase()}`]
                );
              });
            }
            throw new Error(
              'Gender must be specified for gender-specific events',
            );
          } else {
            const totalSpotsQuery = firestore
              .collection('spots')
              .where('eventId', '==', dto.eventId)
              .where('userType', '==', type);
            return transaction.get(totalSpotsQuery).then((snapshot) => {
              return snapshot.size >= eventData[`max${type.toUpperCase()}`];
            });
          }
        };

        if (await maxSpotsExceeded(dto.userType, dto.gender)) {
          throw new Error(
            'The maximum number of spots for this type of user has been reached',
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
            userType: dto.userType,
            gender: dto.gender,
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
      const err = error as Error;
      console.error('Transaction failed: ', err.message);
      throw new Error(err.message);
    }
  }
}
