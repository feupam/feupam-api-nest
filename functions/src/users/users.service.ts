import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as crypto from 'crypto';


@Injectable()
export class UsersService {
  constructor(private firestoreService: FirestoreService) {}

  private gerarHashDoTermo(conteudo: string): string {
    return crypto.createHash('md5').update(conteudo, 'utf8').digest('hex');
  }

  async create(createUserDto: CreateUserDto, email: string) {
    const firestore = this.firestoreService.getFirestore();
    const usersCollection = firestore.collection('users');

    if (!createUserDto.lgpdConsentAccepted) {
      throw new BadRequestException('Usuário não autorizou o tratamento de dados conforme a LGPD');
    }
  
    // Verifique se já existe um usuário com o mesmo CPF
    const existingUserSnapshot = await usersCollection
      .where('cpf', '==', createUserDto.cpf)
      .get();
  
    if (!existingUserSnapshot.empty) {
      throw new BadRequestException('User with this CPF already exists');
    }

    const existingEmailSnapshot = await usersCollection
    .where('email', '==', createUserDto.email)
    .get();

    if (!existingEmailSnapshot.empty) {
      throw new BadRequestException('User with this Email already exists');
    }
  
    const userRef = usersCollection.doc();

    const termoLGPD = `
      Em atenção à Lei Geral de Proteção de Dados Pessoais (LGPD), Lei n. 13.709, de 14 de agosto de
      2018, ao preencher este formulário, você concorda com o tratamento de seus dados pessoais
      de acordo com a Lei Geral de Proteção de Dados (LGPD). Os dados fornecidos serão utilizados
      exclusivamente para a finalidade específica aqui descrita, sendo mantidos em sigilo e segurança
      pela empresa responsável pelo tratamento.
      A empresa responsável pelo tratamento se compromete a adotar medidas técnicas e
      organizacionais adequadas para proteger os dados pessoais contra acessos não autorizados,
      perda ou qualquer outra forma de tratamento inadequado.
      Ao fornecer seus dados pessoais neste formulário, você declara que leu e concorda com esta
      cláusula de tratamento de dados e com a Política de Privacidade da empresa responsável pelo
      tratamento.
      Do direito ao uso de imagem:
      Ao participar de eventos ou atividades promovidas por nossa organização, você autoriza
      expressamente o uso de sua imagem e voz em fotos, vídeos, gravações e demais materiais
      audiovisuais produzidos durante o acampamento. Esses materiais poderão ser utilizados para
      fins publicitários e de divulgação em nossos canais de comunicação, incluindo nossos sites, redes
      sociais, folders e demais materiais de divulgação. Essa autorização é concedida de forma
      gratuita, por tempo indeterminado e sem limite de território. Caso você não concorde com o
      uso de sua imagem e voz, solicitamos que informe a organização com antecedência, por escrito,
      para que possamos tomar as providências cabíveis.
    `;

    const hashDoTermo = this.gerarHashDoTermo(termoLGPD);
      
    const now = new Date().toISOString();
    await userRef.set({
      ...createUserDto,
      email: email,
      createdAt: now,
      lgpdConsent: {
        accepted: true,
        acceptedAt: now,
        version: hashDoTermo,
      },
    });
  
    return { id: userRef.id, ...createUserDto };
  }

  async findAll(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
  
    const snapshot = await this.firestoreService.firestore
      .collection('users')
      .orderBy('createdAt', 'desc') // ou 'name', 'email', etc
      .offset(offset)
      .limit(limit)
      .get();
  
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  
    return {
      page,
      limit,
      count: users.length,
      users,
    };
  }

  async findOne(decodedIdToken) {
    const email = decodedIdToken.email ?? '';
    const userRef = this.firestoreService.firestore
      .collection('users')
      .where('email', '==', email);
  
    const snapshot = await userRef.get();
  
    if (snapshot.empty) {
      throw new NotFoundException('User not found');
    }
  
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data(); // <- Aqui extrai os dados JSON do documento
  
    return userData; // Retorna no formato desejado
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