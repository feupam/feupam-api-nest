import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FirestoreService } from '../firebase/firebase.service';

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
}
