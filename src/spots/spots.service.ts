import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';
import { CreateSpotDto } from './dto/create-spot.dto';
import { SpotStatus } from './dto/enum';

@Injectable()
export class SpotsService {
  constructor(private firestoreService: FirestoreService) {}

  async create(createSpotDto: CreateSpotDto & { eventId: string }) {
    const firestore = this.firestoreService.getFirestore();

    // Verify that the event exists
    const eventRef = firestore.collection('events').doc(createSpotDto.eventId);
    const eventDoc = await eventRef.get();

    if (!eventDoc.exists) {
      throw new NotFoundException('Event not found');
    }

    // Check the total number of spots for the event
    const totalSpots = await this.getTotalSpotsForEvent(createSpotDto.eventId);

    if (totalSpots >= 100) {
      throw new ConflictException(
        'The maximum number of spots for this event has been reached.',
      );
    }
    const spotRef = firestore.collection('spots').doc();
    await spotRef.set({
      ...createSpotDto,
      status: SpotStatus.available,
      type: createSpotDto.type,
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
      throw new NotFoundException('Spot not found');
    }

    return { id: spotDoc.id, ...spotDoc.data() };
  }

  async remove(eventId: string, spotId: string) {
    const firestore = this.firestoreService.getFirestore();
    const spotRef = firestore.collection('spots').doc(spotId);
    const spotDoc = await spotRef.get();

    if (!spotDoc.exists || spotDoc.data()?.eventId !== eventId) {
      throw new NotFoundException('Spot not found');
    }

    await spotRef.delete();
    return { id: spotId };
  }

  private async getTotalSpotsForEvent(eventId: string): Promise<number> {
    const spotsSnapshot = await this.firestoreService
      .getFirestore()
      .collection('spots')
      .where('eventId', '==', eventId)
      .get();
    return spotsSnapshot.size;
  }
}
