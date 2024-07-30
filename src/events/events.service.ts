import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FirestoreService } from '../firebase/firebase.service';
import { EventType, UserType, Gender } from './dto/enum';
import { TicketStatus, SpotStatus } from '../spots/dto/enum';
import { ReserveSpotDto } from './dto/reserve-spot.dto';

@Injectable()
export class EventsService {
  constructor(private firestoreService: FirestoreService) {}

  async create(dto: CreateEventDto) {
    const firestore = this.firestoreService.firestore;
    const eventRef = firestore.collection('events').doc();

    // Dados do evento incluindo tipo e vagas
    const eventData = {
      name: dto.name,
      date: dto.date,
      location: dto.location,
      eventType: dto.eventType,
      maxClientMale: dto.maxClientMale || 0,
      maxClientFemale: dto.maxClientFemale || 0,
      maxStaffMale: dto.maxStaffMale || 0,
      maxStaffFemale: dto.maxStaffFemale || 0,
      maxGeneralSpots: dto.maxGeneralSpots || 0, // Para eventos de vagas gerais
    };

    try {
      await eventRef.set(eventData);
      return { id: eventRef.id, ...eventData };
    } catch (e) {
      throw new BadRequestException(
        'An error occurred while creating the event',
      );
    }
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
      throw new NotFoundException('Event not found');
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

  async reserveSpot(
    dto: ReserveSpotDto & {
      eventId: string;
      userType: UserType;
      gender?: Gender;
    },
  ) {
    const firestore = this.firestoreService.firestore;
    const batch = firestore.batch();

    try {
      // Verifique se o evento existe
      const eventRef = firestore.collection('events').doc(dto.eventId);
      const eventDoc = await eventRef.get();
      if (!eventDoc.exists) {
        throw new NotFoundException('Event not found');
      }

      const eventData = eventDoc.data();
      if (!eventData) {
        throw new Error('Event data is missing');
      }

      // Verifique se os spots existem
      const spotsQuery = firestore
        .collection('spots')
        .where('eventId', '==', dto.eventId)
        .where('name', 'in', dto.spots);
      const spotsSnapshot = await spotsQuery.get();

      const existingSpots = spotsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
        gender: doc.data().gender || Gender.MALE,
      }));

      const foundSpotsName = existingSpots.map((spot) => spot.name);
      const notFoundSpotsName = dto.spots.filter(
        (spotName) => !foundSpotsName.includes(spotName),
      );

      // Crie novos spots se eles não existirem
      for (const spotName of notFoundSpotsName) {
        const spotNumber = parseInt(spotName.match(/\d+/)?.[0] || '0', 10);
        let maxSpots = 0;

        if (eventData.eventType === EventType.GENERAL) {
          maxSpots = eventData.maxGeneralSpots;
        } else if (eventData.eventType === EventType.GENDER_SPECIFIC) {
          if (dto.userType === UserType.CLIENT) {
            maxSpots =
              dto.gender === Gender.MALE
                ? eventData.maxClientMale
                : eventData.maxClientFemale;
          } else if (dto.userType === UserType.STAFF) {
            maxSpots =
              dto.gender === Gender.MALE
                ? eventData.maxStaffMale
                : eventData.maxStaffFemale;
          }
        }

        if (spotNumber > maxSpots) {
          throw new BadRequestException(
            `Spot number ${spotNumber} exceeds the total limit of ${maxSpots}`,
          );
        }

        const newSpotRef = firestore.collection('spots').doc();
        const newSpot = {
          name: spotName,
          eventId: dto.eventId,
          status: SpotStatus.available,
          gender: dto.gender || Gender.MALE,
        };
        batch.set(newSpotRef, newSpot);

        existingSpots.push({
          id: newSpotRef.id,
          name: spotName,
          gender: newSpot.gender,
        });
      }

      // Verifique se o usuário já tem uma reserva
      const userReservationsQuery = firestore
        .collection('reservationHistory')
        .where('email', '==', dto.email)
        .where('eventId', '==', dto.eventId);
      const userReservationsSnapshot = await userReservationsQuery.get();

      if (!userReservationsSnapshot.empty) {
        throw new BadRequestException(
          'User already has a reservation for this event',
        );
      }

      // Lógica para eventos com divisão por gênero
      if (eventData.eventType === EventType.GENDER_SPECIFIC) {
        const maxSpots = {
          clientMale: eventData.maxClientMale,
          clientFemale: eventData.maxClientFemale,
          staffMale: eventData.maxStaffMale,
          staffFemale: eventData.maxStaffFemale,
        };

        const spotsCount = {
          clientMale: 0,
          clientFemale: 0,
          staffMale: 0,
          staffFemale: 0,
        };

        existingSpots.forEach((spot) => {
          if (spot.gender === Gender.MALE) {
            if (dto.userType === UserType.CLIENT) {
              spotsCount.clientMale += 1;
            } else if (dto.userType === UserType.STAFF) {
              spotsCount.staffMale += 1;
            }
          } else if (spot.gender === Gender.FEMALE) {
            if (dto.userType === UserType.CLIENT) {
              spotsCount.clientFemale += 1;
            } else if (dto.userType === UserType.STAFF) {
              spotsCount.staffFemale += 1;
            }
          }
        });

        // Verifique se as reservas excedem os limites por gênero e tipo
        if (
          spotsCount.clientMale > maxSpots.clientMale ||
          spotsCount.clientFemale > maxSpots.clientFemale ||
          spotsCount.staffMale > maxSpots.staffMale ||
          spotsCount.staffFemale > maxSpots.staffFemale
        ) {
          throw new BadRequestException(
            'The number of spots reserved exceeds the limit for the specified gender or type',
          );
        }
      }

      // Criação de reservas e atualização de status dos spots
      existingSpots.forEach((spot) => {
        const reservationRef = firestore.collection('reservationHistory').doc();
        batch.set(reservationRef, {
          spotId: spot.id,
          ticketKind: dto.ticket_kind,
          email: dto.email,
          status: TicketStatus.reserved,
          userType: dto.userType,
          gender: spot.gender,
          eventId: dto.eventId,
        });

        const spotRef = firestore.collection('spots').doc(spot.id);
        batch.update(spotRef, {
          status: SpotStatus.reserved,
        });

        const ticketRef = firestore.collection('tickets').doc();
        batch.set(ticketRef, {
          spotId: spot.id,
          ticketKind: dto.ticket_kind,
          email: dto.email,
          eventId: dto.eventId,
        });
      });

      await batch.commit();
      return existingSpots.map((spot) => ({
        spotId: spot.id,
        ticketKind: dto.ticket_kind,
        email: dto.email,
        eventId: dto.eventId,
      }));
    } catch (e) {
      throw new BadRequestException('An error occurred while reserving spots');
    }
  }
}
