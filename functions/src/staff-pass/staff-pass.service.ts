import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';

@Injectable()
export class StaffPassService {
  constructor(private readonly firestoreService: FirestoreService) {}

  async create(eventId: string, staff_pass: string) {
    const collection =
      this.firestoreService.firestore.collection('staffPasswords');

    // Check if the eventId already exists
    const snapshot = await collection.where('eventId', '==', eventId).get();
    if (!snapshot.empty) {
      throw new Error('Event ID already exists. Use update to modify.');
    }

    // Add new entry to the collection
    await collection.add({ eventId, staff_pass });
    return this.findAll();
  }

  async update(eventId: string, staff_pass: string) {
    const collection =
      this.firestoreService.firestore.collection('staffPasswords');

    // Find the document with the given eventId
    const snapshot = await collection.where('eventId', '==', eventId).get();
    if (snapshot.empty) {
      throw new NotFoundException('Event ID not found.');
    }

    // Update the staff_pass
    const doc = snapshot.docs[0];
    await doc.ref.update({ staff_pass });
    return this.findAll();
  }

  async remove(eventId: string) {
    const collection =
      this.firestoreService.firestore.collection('staffPasswords');

    // Find the document with the given eventId
    const snapshot = await collection.where('eventId', '==', eventId).get();
    if (snapshot.empty) {
      throw new NotFoundException('Event ID not found.');
    }

    // Remove the document
    const doc = snapshot.docs[0];
    await doc.ref.delete();
    return this.findAll();
  }

  async read(eventId: string, staff_pass: string): Promise<boolean> {
    const collection =
      this.firestoreService.firestore.collection('staffPasswords');

    // Check if the eventId and staff_pass match
    const snapshot = await collection
      .where('eventId', '==', eventId)
      .where('staff_pass', '==', staff_pass)
      .get();

    return !snapshot.empty; // Return true if entry exists, false otherwise
  }

  // Helper method to get all entries (useful for testing or debugging)
  private async findAll() {
    const collection =
      this.firestoreService.firestore.collection('staffPasswords');
    const snapshot = await collection.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
}
