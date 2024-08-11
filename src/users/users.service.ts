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

  async findOne(decodedIdToken) {
    console.log('oi');
    const email = decodedIdToken.email ?? '';
    const userRef = this.firestoreService.firestore
      .collection('users')
      .where('email', '==', email);
    const doc = await userRef.get();
    if (doc.empty) {
      throw new NotFoundException('User not found');
    }
    const userId = doc.docs[0];
    return { userId };
  }

  async update(decodedIdToken, updateUserDto: UpdateUserDto) {
    const email = decodedIdToken.email ?? '';

    const userRef = this.firestoreService.firestore
      .collection('users')
      .where('email', '==', email);
    const querySnapshot = await userRef.get();
    await querySnapshot.docs.map(async (doc) => {
      doc.data();
      return doc.ref.update({
        ...updateUserDto,
        updatedAt: new Date().toISOString(),
      });
    });

    return { updateUserDto };
  }

  async remove(decodedIdToken) {
    const email = decodedIdToken.email ?? '';
    const userRef = this.firestoreService.firestore
      .collection('users')
      .where('email', '==', email);

    const querySnapshot = await userRef.get();

    if (querySnapshot.empty) {
      return { message: 'No user found with the provided email' };
    }

    const batch = this.firestoreService.firestore.batch();

    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return { message: 'User(s) deleted successfully' };
  }

  async getUserReservations(decodedIdToken) {
    const email = decodedIdToken.email ?? '';
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

  async cancelUserReservations(decodedIdToken) {
    const firestore = this.firestoreService.firestore;
    const email = decodedIdToken.email ?? '';
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
