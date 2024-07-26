import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FirestoreService } from '../firebase/firebase.service';
import { ReserveSpotDto } from './dto/reserve-spot.dto';
import { SpotStatus, TicketStatus } from '../spots/dto/enum';

@Injectable()
export class EventsService {
  constructor(private firestoreService: FirestoreService) {}

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

  async reserveSpot(dto: ReserveSpotDto & { eventId: string }) {
    const spotsSnapshot = await this.firestoreService.firestore
      .collection('spots')
      .where('eventId', '==', dto.eventId)
      .where('name', 'in', dto.spots)
      .get();

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

    const batch = this.firestoreService.firestore.batch();

    spots.forEach((spot) => {
      const reservationHistoryRef = this.firestoreService.firestore
        .collection('reservationHistory')
        .doc();
      batch.set(reservationHistoryRef, {
        spotId: spot.id,
        ticketKind: dto.ticket_kind,
        email: dto.email,
        status: TicketStatus.reserved,
        createAt: new Date(),
        updateAt: new Date(),
      });

      const spotRef = this.firestoreService.firestore
        .collection('spots')
        .doc(spot.id);
      batch.update(spotRef, { status: SpotStatus.reserved });
    });

    const ticketRefs = spots.map((spot) => {
      const ticketRef = this.firestoreService.firestore
        .collection('tickets')
        .doc();
      batch.set(ticketRef, {
        spotId: spot.id,
        ticketKind: dto.ticket_kind,
        email: dto.email,
        createAt: new Date(),
        updateAt: new Date(),
      });
      return ticketRef;
    });

    try {
      await batch.commit();
      const tickets = await Promise.all(
        ticketRefs.map((ref) =>
          ref.get().then((doc) => ({ id: doc.id, ...doc.data() })),
        ),
      );
      return tickets;
    } catch (e) {
      console.error('Error reserving spots:', e);
      throw e;
    }
  }
}
