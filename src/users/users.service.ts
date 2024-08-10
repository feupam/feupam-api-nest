import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private firestoreService: FirestoreService) {}

  private userCollection = this.firestoreService.firestore.collection('users');

  async create(createUserDto: CreateUserDto) {
    const firestore = this.firestoreService.getFirestore();
    const usersCollection = firestore.collection('users');

    // Verifique se já existe um usuário com o mesmo CPF
    const existingUserSnapshot = await usersCollection
      .where('cpf', '==', createUserDto.cpf)
      .get();

    if (!existingUserSnapshot.empty) {
      throw new BadRequestException('User with this CPF already exists');
    }

    const userRef = usersCollection.doc();
    await userRef.set({
      ...createUserDto,
      createdAt: new Date().toISOString(),
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
      updatedAt: new Date().toISOString(),
    });
    return { id, ...updateUserDto };
  }

  async remove(id: string) {
    const userRef = this.firestoreService.firestore.collection('users').doc(id);
    await userRef.delete();
    return { id };
  }

  async getUserReservations(email: string) {
    const reservationsSnapshot = await this.firestoreService.firestore
      .collection('reservationHistory')
      .where('email', '==', email)
      .get();

    if (reservationsSnapshot.empty) {
      throw new NotFoundException('Reservations not found for this user');
    }

    return reservationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  async updateUserReservations(email: string) {
    const firestore = this.firestoreService.firestore;

    // Obtém todas as reservas do usuário com o e-mail fornecido
    const reservationsSnapshot = await firestore
      .collection('reservationHistory')
      .where('email', '==', email)
      .get();

    if (reservationsSnapshot.empty) {
      throw new NotFoundException('Reservations not found for this user');
    }

    // Obtém o primeiro documento de reserva
    const firstReservationDoc = reservationsSnapshot.docs[0];
    const reservationData = firstReservationDoc.data();
    const spotId = reservationData.spotId;

    // Atualiza o status da reserva e o spotId para uma string vazia
    await firstReservationDoc.ref.update({
      status: 'cancelled',
      spotId: '',
      updatedAt: new Date(),
    });

    if (spotId) {
      // Deleta o documento do spot se spotId estiver presente
      const spotRef = firestore.collection('spots').doc(spotId);
      try {
        await spotRef.delete();
      } catch (error) {
        throw new BadRequestException('Error deleting spot document');
      }
    }

    return {
      email: email,
      message: 'Reserva cancelada',
    };
  }
}
