import { Injectable } from '@nestjs/common';
import { CreateSpotDto } from './dto/create-spot.dto';
import { FirestoreService } from '../firebase/firebase.service';
import { SpotStatus } from './dto/enum';

@Injectable()
export class SpotsService {
  constructor(private firestoreService: FirestoreService) {}

  async create(createSpotDto: CreateSpotDto & { eventId: string }) {
    const firestore = this.firestoreService.getFirestore();

    const eventRef = firestore.collection('events').doc(createSpotDto.eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      throw new Error('Event not found');
    }

    const spotRef = firestore.collection('spots').doc();
    await spotRef.set({
      ...createSpotDto,
      eventId: createSpotDto.eventId,
      status: SpotStatus.available,
      createAt: new Date(),
      updateAt: new Date(),
    });

    return { id: spotRef.id, ...createSpotDto, status: SpotStatus.available };
  }

  async findAll(eventId: string) {
    const firestore = this.firestoreService.getFirestore();
    const spotsSnapshot = await firestore
      .collection('spots')
      .where('eventId', '==', eventId)
      .get();

    return spotsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findOne(eventId: string, spotId: string) {
    const firestore = this.firestoreService.getFirestore();
    const spotRef = firestore.collection('spots').doc(spotId);
    const spotDoc = await spotRef.get();

    if (!spotDoc.exists || spotDoc.data()?.eventId !== eventId) {
      throw new Error('Spot not found');
    }

    return { id: spotDoc.id, ...spotDoc.data() };
  }

  async remove(eventId: string, spotId: string) {
    const firestore = this.firestoreService.getFirestore();
    const spotRef = firestore.collection('spots').doc(spotId);
    const spotDoc = await spotRef.get();

    if (!spotDoc.exists || spotDoc.data()?.eventId !== eventId) {
      throw new Error('Spot not found');
    }

    await spotRef.delete();
    return { id: spotId };
  }
}
