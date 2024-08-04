import { Injectable, NotFoundException } from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  async getUserReservations(userId: string) {
    const reservationsSnapshot = await this.firestoreService.firestore
      .collection('reservationHistory')
      .where('userId', '==', userId)
      .get();

    if (reservationsSnapshot.empty) {
      throw new NotFoundException('Reservations not found for this user');
    }

    return reservationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }
}
