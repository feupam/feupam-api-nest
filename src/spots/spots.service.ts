import { Injectable } from '@nestjs/common';
import { CreateSpotDto } from './dto/create-spot.dto';
import { FirestoreService } from '../firebase/firebase.service';
import { SpotStatus } from './dto/enum';

@Injectable()
export class SpotsService {
  constructor(private firestoreService: FirestoreService) {}

  async create(createSpotDto: CreateSpotDto & { eventId: string }) {
    const firestore = this.firestoreService.getFirestore();

    try {
      return await firestore.runTransaction(async (transaction) => {
        const eventRef = firestore
          .collection('events')
          .doc(createSpotDto.eventId);
        const eventDoc = await transaction.get(eventRef);

        if (!eventDoc.exists) {
          throw new Error('Event not found');
        }

        const spotsRef = firestore
          .collection('spots')
          .where('eventId', '==', createSpotDto.eventId);
        const spotsSnapshot = await transaction.get(spotsRef);

        if (spotsSnapshot.size >= 100) {
          throw new Error('Spot limit reached for this event');
        }

        const spotRef = firestore.collection('spots').doc();
        transaction.set(spotRef, {
          ...createSpotDto,
          eventId: createSpotDto.eventId,
          status: SpotStatus.available,
          createAt: new Date(),
          updateAt: new Date(),
        });

        return {
          id: spotRef.id,
          ...createSpotDto,
          status: SpotStatus.available,
        };
      });
    } catch (error) {
      console.error('Transaction failed: ', error.message);
      throw new Error(error.message);
    }
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
