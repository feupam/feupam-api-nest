import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FirestoreService } from '../firebase/firebase.service';
import { SpotStatus, TicketStatus } from 'src/spots/dto/enum';
import { ReserveSpotDto } from './dto/reserve-spot.dto';

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
      const reservationRef = this.firestoreService.firestore
        .collection('reservationHistory')
        .doc();
      batch.set(reservationRef, {
        spotId: spot.id,
        ticketKind: dto.ticket_kind,
        email: dto.email,
        status: TicketStatus.reserved,
      });

      const spotRef = this.firestoreService.firestore
        .collection('spots')
        .doc(spot.id);
      batch.update(spotRef, {
        status: SpotStatus.reserved,
      });

      const ticketRef = this.firestoreService.firestore
        .collection('tickets')
        .doc();
      batch.set(ticketRef, {
        spotId: spot.id,
        ticketKind: dto.ticket_kind,
        email: dto.email,
      });
    });

    try {
      await batch.commit();
      return spots.map((spot) => ({
        spotId: spot.id,
        ticketKind: dto.ticket_kind,
        email: dto.email,
      }));
    } catch (e) {
      console.log('Error reserving spots:', e);
      throw new Error('An error occurred while reserving spots');
    }
  }
}
