import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';
import { UserType } from '../events/dto/enum';
import { TicketKind } from '../events/dto/enum-spot';

@Injectable()
export class AdminService {
  constructor(private readonly firestoreService: FirestoreService) {}

  async applyDiscount(email: string, discountBody: number, eventId: string) {
    if (discountBody < 0 || discountBody > 1) {
      throw new BadRequestException('Discount must be between 0 and 1');
    }
    const userRef = this.firestoreService.firestore
      .collection('users')
      .where('email', '==', email);
    const querySnapshot = await userRef.get();

    const userDoc = querySnapshot.docs[0];
    const dataUser = userDoc.data();
    const discount = dataUser.discount || [];
    const existingCouponIndex = discount.findIndex(
      (discount) => discount.event === eventId,
    );
    if (existingCouponIndex > -1) {
      discount[existingCouponIndex] = { event: eventId, discount: discountBody };
    } else {
      discount.push({ event: eventId, discount: discountBody });
    }

    await userDoc.ref.update({ discount });
    await querySnapshot.docs.map(async (doc) => {
      doc.data();
      return doc.ref.update({
        discount: discount,
      });
    });

    return { message: 'Discount applied successfully' };
  }

  public async createFastUser(email: string) {
    const newUserRef = await this.firestoreService.firestore
      .collection('users')
      .add({
        email: email,
        userType: 'client',
        name: 'ALTERE',
        church: 'ALTERE',
        pastor: 'ALTERE',
        ddd: '35',
        cellphone: '000000000',
        gender: 'ALTERE',
        cep: '00000000',
        cpf: '00000000000',
        data_nasc: '00/00/0000',
        idade: 0,
        responsavel: 'ALTERE',
        documento_responsavel: '00000000000',
        ddd_responsavel: '35',
        cellphone_responsavel: '000000000',
        address: 'ALTERE',
        complemento: '',
        cidade: 'ALTERE',
        estado: 'MG',
        alergia: 'Não',
        medicamento: 'Não',
        info_add: 'Nao',
        createdAt: new Date(),
      });
    return {
      message: 'User created successfully with fake data',
      id: newUserRef.id,
    };
  }

  async freeEvent(email: string, eventId: string) {
    // Verifica se o usuário já existe
    const userRef = this.firestoreService.firestore
      .collection('users')
      .where('email', '==', email);
    const querySnapshot = await userRef.get();

    let userId;
    if (querySnapshot.empty) {
      userId = this.createFastUser(email);
    } else {
      userId = querySnapshot.docs[0];
    }

    // Cria uma nova reserva gratuita
    const reservationRef = this.firestoreService.firestore
      .collection('reservationHistory')
      .where('email', '==', email);
    const reservationSnapshot = await reservationRef.get();
    if (reservationSnapshot.empty) {
      this.firestoreService.firestore.collection('reservationHistory').add({
        email,
        status: 'Pago',
        event: eventId,
        ticketKind: TicketKind.FULL,
        chargeId: [
          {
            event: eventId,
            meio: 'FREE',
            userID: userId.id,
            email: email,
            lote: '',
            envioWhatsapp: false,
            amount: 0,
            status: 'Pago',
            chargeId: '',
          },
        ],
      });
    } else {
      await reservationSnapshot.docs.map(async (doc) => {
        doc.data();
        return doc.ref.update({
          email,
          status: 'Pago',
          event: eventId,
          ticketKind: TicketKind.FULL,
          chargeId: [
            {
              event: eventId,
              meio: 'FREE',
              userID: userId.id,
              email: email,
              lote: '',
              envioWhatsapp: false,
              amount: 0,
              status: 'Pago',
              chargeId: '',
            },
          ],
        });
      });
    }
    return { message: 'Event reservation created successfully' };
  }

  async setStaffStatus(email: string, isStaff: boolean) {
    const userRef = this.firestoreService.firestore
      .collection('users')
      .where('email', '==', email);
    const querySnapshot = await userRef.get();
    await querySnapshot.docs.map(async (doc) => {
      doc.data();
      return doc.ref.update({
        userType: UserType.STAFF,
      });
    });

    return { message: `Staff status updated to ${isStaff}` };
  }

  async updateEmail(email: string, newEmail: string) {
    // Atualiza o email na coleção reservationHistory
    const userRef = this.firestoreService.firestore
      .collection('users')
      .where('email', '==', email);
    const querySnapshot = await userRef.get();
    if (querySnapshot.empty) {
      throw new NotFoundException('User not found');
    }
    await querySnapshot.docs.map(async (doc) => {
      doc.data();
      return doc.ref.update({
        email: newEmail,
      });
    });

    return { message: 'Email updated successfully' };
  }

  async getAllReservationHistory(eventId?: string, page = 1, limit = 50) {
    const firestore = this.firestoreService.firestore;
    const offset = (page - 1) * limit;

    try {
      // Buscar TODAS as reservas da reservationHistory
      let reservationsQuery: any = firestore.collection('reservationHistory');

      // Se eventId foi fornecido, filtrar por evento
      if (eventId) {
        reservationsQuery = reservationsQuery.where('eventId', '==', eventId);
      }

      // Buscar todas as reservas sem orderBy para evitar necessidade de índice
      const reservationsSnapshot = await reservationsQuery.get();
      
      // Total de documentos antes da paginação
      const totalCount = reservationsSnapshot.docs.length;

      // Ordenar em memória por createdAt e aplicar paginação
      const paginatedReservations = reservationsSnapshot.docs
        .map((doc: any) => ({ 
          id: doc.id, 
          ...doc.data(),
          // Converter Timestamp do Firestore para ISO string
          createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate().toISOString() : doc.data().updatedAt,
        }))
        .sort((a: any, b: any) => {
          // Ordenar por createdAt descendente (mais recente primeiro)
          const aTime = new Date(a.createdAt).getTime() || 0;
          const bTime = new Date(b.createdAt).getTime() || 0;
          return bTime - aTime;
        })
        .slice(offset, offset + limit);

      return {
        page,
        limit,
        totalCount,
        count: paginatedReservations.length,
        eventId: eventId || 'all',
        reservations: paginatedReservations,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new BadRequestException(`Erro ao buscar reservationHistory: ${errorMessage}`);
    }
  }
}
