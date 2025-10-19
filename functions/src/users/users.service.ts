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

  async create(createUserDto: CreateUserDto, email: string, eventAdd?: string) {
    const firestore = this.firestoreService.getFirestore();
    const usersCollection = firestore.collection('users');

    if (!createUserDto.lgpdConsentAccepted) {
      throw new BadRequestException('Usuário não autorizou o tratamento de dados conforme a LGPD');
    }
  
    // Se eventAdd foi fornecido, verificar se já existe reserva para este CPF neste evento
    if (eventAdd) {
      const existingReservationSnapshot = await firestore
        .collection('reservationHistory')
        .where('cpf', '==', createUserDto.cpf)
        .where('eventId', '==', eventAdd)
        .get();
      
      if (!existingReservationSnapshot.empty) {
        const reservationData = existingReservationSnapshot.docs[0].data();
        const reservationEmail = reservationData.email || '';
        
        // Mascarar email: mostrar apenas as primeiras 5 letras
        const maskedEmail = reservationEmail.length > 5 
          ? `${reservationEmail.substring(0, 5)}${'*'.repeat(reservationEmail.length - 5)}`
          : reservationEmail;
        
        throw new BadRequestException(
          `Você já possui cadastro para esse evento com o email ${maskedEmail}`
        );
      }
    }

    // Verifique se já existe um usuário com o mesmo CPF
    const existingUserSnapshot = await usersCollection
      .where('cpf', '==', createUserDto.cpf)
      .get();
  
    if (!existingUserSnapshot.empty) {
      throw new BadRequestException('User with this CPF already exists');
    }

    const existingEmailSnapshot = await usersCollection
    .where('email', '==', email)
    .get();

    if (!existingEmailSnapshot.empty) {
      throw new BadRequestException('User with this Email already exists');
    }
  
    const userRef = usersCollection.doc();

    const termoLGPD = `
      Autorização de Uso de Dados e Imagem

      Autorizo que meus dados pessoais informados neste formulário sejam coletados 
      e usados pela equipe do acampamento para fins de inscrição, comunicação e 
      segurança, conforme a Lei n° 13.709/2018 (LGPD). Também autorizo, de forma 
      gratuita, o uso da minha imagem e/ou voz em fotos e vídeos feitos durante o 
      evento para divulgação institucional em redes sociais, sites ou materiais do 
      acampamento.
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
    
    // Buscar TODAS as reservas na coleção 'reservationHistory' (sem filtro de status)
    const reservationsSnapshot = await this.firestoreService.firestore
      .collection('reservationHistory')
      .where('email', '==', email)
      .get();

    if (reservationsSnapshot.empty) {
      return []; // Retorna array vazio ao invés de erro
    }

    // Ordenar por data de atualização (mais recente primeiro)
    const reservations = reservationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Ordenar por updatedAt se disponível
    reservations.sort((a: any, b: any) => {
      const aTime = a.updatedAt?.toDate?.() || a.updatedAt?._seconds || 0;
      const bTime = b.updatedAt?.toDate?.() || b.updatedAt?._seconds || 0;
      return bTime - aTime; // Mais recente primeiro
    });

    return reservations;
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

  async getUsersWithReservations(eventId?: string, page = 1, limit = 50) {
    const firestore = this.firestoreService.firestore;
    const offset = (page - 1) * limit;

    try {
      // Buscar TODAS as reservas da reservationHistory primeiro (sem orderBy para evitar índice)
      let reservationsQuery: any = firestore.collection('reservationHistory');

      // Se eventId foi fornecido, filtrar por evento
      if (eventId) {
        reservationsQuery = reservationsQuery.where('eventId', '==', eventId);
      }

      // Buscar todas as reservas sem orderBy
      const reservationsSnapshot = await reservationsQuery.get();
      
      // Ordenar em memória e aplicar paginação
      const paginatedReservations = reservationsSnapshot.docs
        .map((doc: any) => ({ doc, data: doc.data() }))
        .sort((a: any, b: any) => {
          // Ordenar por createdAt descendente (mais recente primeiro)
          const aTime = a.data.createdAt?.toDate ? a.data.createdAt.toDate().getTime() : 
                       (a.data.createdAt?.getTime ? a.data.createdAt.getTime() : 0);
          const bTime = b.data.createdAt?.toDate ? b.data.createdAt.toDate().getTime() : 
                       (b.data.createdAt?.getTime ? b.data.createdAt.getTime() : 0);
          return bTime - aTime;
        })
        .slice(offset, offset + limit);

      // Para cada reserva, buscar os dados completos do usuário
      // OTIMIZADO: Como o reservationHistory agora contém todos os dados do usuário,
      // não precisamos mais fazer JOIN com a coleção 'users'
      const usersWithReservations = paginatedReservations.map((reservationItem: any) => {
        const reservationDoc = reservationItem.doc;
        const reservationData = reservationDoc.data();
        
        // Extrair dados do usuário que já estão no reservationHistory
        const userData = {
          id: reservationData.userId || 'N/A',
          email: reservationData.email,
          name: reservationData.name || 'Nome não disponível',
          cpf: reservationData.cpf,
          data_nasc: reservationData.data_nasc,
          idade: reservationData.idade,
          gender: reservationData.gender,
          userType: reservationData.userType,
          church: reservationData.church,
          pastor: reservationData.pastor,
          ddd: reservationData.ddd,
          cellphone: reservationData.cellphone,
          cep: reservationData.cep,
          cidade: reservationData.cidade,
          estado: reservationData.estado,
          address: reservationData.address,
          complemento: reservationData.complemento,
          responsavel: reservationData.responsavel,
          documento_responsavel: reservationData.documento_responsavel,
          ddd_responsavel: reservationData.ddd_responsavel,
          cellphone_responsavel: reservationData.cellphone_responsavel,
          alergia: reservationData.alergia,
          medicamento: reservationData.medicamento,
          info_add: reservationData.info_add,
          discount: reservationData.discount,
          nomeMae: reservationData.nomeMae,
          nomePai: reservationData.nomePai,
          contato2: reservationData.contato2,
          contato3: reservationData.contato3,
          alergiaAlimentar: reservationData.alergiaAlimentar,
          alergiaPicadaInsetos: reservationData.alergiaPicadaInsetos,
          outrasAlergias: reservationData.outrasAlergias,
          condicoesSaude: reservationData.condicoesSaude,
          medicamentoContinuado: reservationData.medicamentoContinuado,
          podeAtisFisica: reservationData.podeAtisFisica,
          transtornosDesenvolvimento: reservationData.transtornosDesenvolvimento,
          autorizaFotosVideos: reservationData.autorizaFotosVideos,
        };

        // Dados completos da reserva
        const reservation = {
          id: reservationDoc.id,
          email: reservationData.email,
          eventId: reservationData.eventId,
          status: reservationData.status,
          price: reservationData.price,
          ticketKind: reservationData.ticketKind,
          userType: reservationData.userType,
          gender: reservationData.gender,
          spotId: reservationData.spotId,
          createdAt: reservationData.createdAt,
          updatedAt: reservationData.updatedAt,
          // PADRONIZADO: Sempre usar 'charges' (array)
          // Fallback para chargeId legado se existir
          charges: reservationData.charges || [],
          // Incluir todos os outros campos da reserva
          ...reservationData
        };

        return {
          // Todos os dados do usuário
          user: userData,
          reservation: reservation,
          // Calcular valor total se houver charges
          totalAmount: Array.isArray(reservation.charges) 
            ? reservation.charges.reduce((sum: number, charge: any) => sum + (charge.amount || 0), 0)
            : 0,
        };
      });

      return {
        page,
        limit,
        eventId: eventId || 'all',
        totalReservations: usersWithReservations.length,
        data: usersWithReservations,
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Error fetching users with reservations: ${error.message}`,
      );
    }
  }

  async checkCpfReservation(cpf: string, eventId: string) {
    const firestore = this.firestoreService.getFirestore();
    
    try {
      // Verificar se já existe reserva para este CPF neste evento
      const existingReservationSnapshot = await firestore
        .collection('reservationHistory')
        .where('cpf', '==', cpf)
        .where('eventId', '==', eventId)
        .get();
      
      if (existingReservationSnapshot.empty) {
        return {
          hasReservation: false,
          message: 'CPF disponível para reserva'
        };
      }

      const reservationData = existingReservationSnapshot.docs[0].data();
      const reservationEmail = reservationData.email || '';
      
      // Mascarar email: mostrar apenas as primeiras 5 letras
      const maskedEmail = reservationEmail.length > 5 
        ? `${reservationEmail.substring(0, 5)}${'*'.repeat(reservationEmail.length - 5)}`
        : reservationEmail;
      
      return {
        hasReservation: true,
        status: reservationData.status,
        email: maskedEmail,
        message: reservationData.status === 'Pago' 
          ? `Este CPF já possui um ingresso pago para este evento com o email ${maskedEmail}`
          : `Este CPF já possui uma reserva para este evento com o email ${maskedEmail}`
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Erro ao verificar CPF: ${error.message}`,
      );
    }
  }
}