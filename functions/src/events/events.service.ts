import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FirestoreService } from '../firebase/firebase.service';
import { ReservationService } from '../reservation/reservation.service';
import { EventType } from './dto/enum';
import { ReserveSpotDto } from './dto/reserve-spot.dto';
import { Timestamp } from 'firebase-admin/firestore';
import * as moment from 'moment-timezone';
import 'multer';

@Injectable()
export class EventsService {
  constructor(
    private readonly firestoreService: FirestoreService,
    private readonly reservationService: ReservationService,
  ) {}

  private async uploadFile(file: Express.Multer.File, folder: string) {
    try {
      console.log('Iniciando upload do arquivo:', file.originalname);
      const bucket = this.firestoreService.storage.bucket();
      console.log('Bucket obtido:', bucket.name);
      
      const filename = `${folder}/${Date.now()}_${file.originalname}`;
      const fileRef = bucket.file(filename);

      await fileRef.save(file.buffer, {
        contentType: file.mimetype,
        public: true,
      });

      console.log('Arquivo salvo com sucesso');
      return `https://storage.googleapis.com/${bucket.name}/${filename}`;
    } catch (error) {
      console.error('Erro no upload do arquivo:', error);
      throw new Error(`Erro no upload: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async create(dto: CreateEventDto, files?: { image_capa?: Express.Multer.File[], logo_evento?: Express.Multer.File[] }) {
    const firestore = this.firestoreService.firestore;
    const eventId = dto.name;
    const eventRef = firestore.collection('events').doc(eventId);

    // Upload das imagens se existirem
    if (files?.image_capa?.[0]) {
      dto.image_capa = await this.uploadFile(files.image_capa[0], 'event_covers');
    }
    if (files?.logo_evento?.[0]) {
      dto.logo_evento = await this.uploadFile(files.logo_evento[0], 'event_logos');
    }

    try {
      await eventRef.set({ ...dto });
      return { uuid: eventRef.id, ...dto };
    } catch (e) {
      throw new BadRequestException(`Erro ao criar evento: ${e}`);
    }
  }

  async findAll() {
    const snapshot = await this.firestoreService.firestore
      .collection('events')
      .get();
    return snapshot.docs.map((doc) => ({ uuid: doc.id, ...doc.data() }));
  }

  async findOne(uuid: string) {
    const eventRef = this.firestoreService.firestore
      .collection('events')
      .doc(uuid);
    const doc = await eventRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Event not found');
    }
    return { uuid: doc.id, ...doc.data() };
  }

  async update(uuid: string, updateEventDto: UpdateEventDto, files?: { image_capa?: Express.Multer.File[], logo_evento?: Express.Multer.File[] }) {
    const eventRef = this.firestoreService.firestore.collection('events').doc(uuid);

    if (files?.image_capa?.[0]) {
      updateEventDto.image_capa = await this.uploadFile(files.image_capa[0], 'event_covers');
    }
    if (files?.logo_evento?.[0]) {
      updateEventDto.logo_evento = await this.uploadFile(files.logo_evento[0], 'event_logos');
    }

    // Se owner vier no update, preserva; se não vier, mantém o existente
    const existing = await eventRef.get();
    const existingData = existing.exists ? existing.data() : {};
    const ownerToPersist = updateEventDto.owner ?? existingData?.owner;

    await eventRef.update({
      ...updateEventDto,
      owner: ownerToPersist,
      date: new Date().toISOString(),
    });

    return { uuid, ...existingData, ...updateEventDto, owner: ownerToPersist };
  }

  async remove(uuid: string) {
    const eventRef = this.firestoreService.firestore
      .collection('events')
      .doc(uuid);
    await eventRef.delete();
    return { uuid };
  }

  async checkRegistrationStatus() {
    const snapshot = await this.firestoreService.firestore
      .collection('events')
      .get();

    if (snapshot.empty) {
      throw new NotFoundException('No events found');
    }

    const timeZone = 'America/Sao_Paulo';
    const currentDateInBrazil = moment.tz(new Date(), timeZone).toDate();

    const events = snapshot.docs.map((doc, index) => {
      const data = doc.data();

      const startDate =
        data.startDate instanceof Timestamp
          ? moment.tz(data.startDate.toDate(), timeZone).toDate()
          : moment.tz(new Date(data.startDate), timeZone).toDate();

      const endDate =
        data.endDate instanceof Timestamp
          ? moment.tz(data.endDate.toDate(), timeZone).toDate()
          : moment.tz(new Date(data.endDate), timeZone).toDate();

      const isOpen =
        currentDateInBrazil >= startDate && currentDateInBrazil <= endDate;

      return {
        id: index + 1, // ou pode usar doc.id se preferir
        name: data.name,
        description: data.description,
        date: data.date,
        date_range: data.date_range,
        range_date: data.range_date,
        location: data.location,
        startDate: data.startDate,
        endDate: data.endDate,
        price: data.price,
        isOpen,
        image_capa: data.image_capa || null,
        logo_evento: data.logo_evento || null,
        idadeMinima: data.idadeMinima,
        idadeMaxima: data.idadeMaxima,
        owner: data.owner || null,
      };
    });

    return {
      currentDate: currentDateInBrazil.toISOString(),
      events,
    };
  }


  public async checkSpot(eventId: string) {
    const firestore = this.firestoreService.firestore;

    try {
      // Verificar se o evento existe
      const eventRef = firestore.collection('events').doc(eventId);
      const eventDoc = await eventRef.get();
      if (!eventDoc.exists) {
        throw new NotFoundException('Event not found');
      }

      const eventData = eventDoc.data();
      if (!eventData) {
        throw new NotFoundException('Event data is missing');
      }

      // Buscar estatísticas do evento no novo sistema
      const eventStatsRef = firestore.collection('eventStats').doc(eventId);
      const eventStatsDoc = await eventStatsRef.get();
      
      const currentStats = eventStatsDoc.exists ? eventStatsDoc.data() : {
        totalPaid: 0,
        malePaid: 0,
        femalePaid: 0,
        totalReserved: 0,
        maleReserved: 0,
        femaleReserved: 0
      };

      // Verificar se ainda há vagas disponíveis
      const totalOccupied = (currentStats.totalPaid || 0) + (currentStats.totalReserved || 0);
      const MAX_TOTAL_SPOTS = 173; // ou usar valor do evento se configurável
      
      if (totalOccupied >= MAX_TOTAL_SPOTS) {
        // Adicionar à waiting list (mantendo comportamento original)
        const email = 'test@test.com'; // valor padrão do método original
        const waitingListRef = firestore.collection('waitingList').doc(eventId);
        const waitingListDoc = await waitingListRef.get();

        if (waitingListDoc.exists) {
          const waitingListData = waitingListDoc.data();
          const existingEmails = waitingListData?.emails || [];

          if (!existingEmails.includes(email)) {
            const updatedEmails = [...existingEmails, email];
            await waitingListRef.set(
              { emails: updatedEmails },
              { merge: true },
            );
          }
        } else {
          await waitingListRef.set({
            emails: [email],
          });
        }

        return false;
      }
      
      return true;
    } catch (e) {
      return false;
    }
  }

  async reserveSpot(
    dto: ReserveSpotDto & {
      eventId: string;
    },
    email: string,
  ) {
    try {
      console.log(`[DEBUG] Reserve spot called for email: ${email}, eventId: ${dto.eventId}`);
      const firestore = this.firestoreService.firestore;

      // Buscar dados do usuário
      const userQuery = firestore
        .collection('users')
        .where('email', '==', email);
      const userSnapshot = await userQuery.get();
      
      if (userSnapshot.empty) {
        throw new BadRequestException('Usuário não encontrado');
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();

      if (!userData || !['male', 'female'].includes(userData.gender)) {
        throw new BadRequestException('Usuário não encontrado ou gênero não especificado');
      }

      // Buscar dados do evento para validar idade
      const eventDoc = await firestore.collection('events').doc(dto.eventId).get();
      if (!eventDoc.exists) {
        throw new BadRequestException('Evento não encontrado');
      }
      const eventData = eventDoc.data();

      // Validar idade do usuário
      if (userData.idade !== undefined && eventData?.idadeMinima !== undefined) {
        const userAge = userData.idade;
        
        if (userAge < eventData.idadeMinima) {
          throw new BadRequestException(
            `Idade mínima para este evento é ${eventData.idadeMinima} anos. Sua idade: ${userAge} anos.`
          );
        }
        
        if (eventData.idadeMaxima !== undefined && userAge > eventData.idadeMaxima) {
          throw new BadRequestException(
            `Idade máxima para este evento é ${eventData.idadeMaxima} anos. Sua idade: ${userAge} anos.`
          );
        }
      }

      // ✅ USAR APENAS O NOVO SISTEMA DE RESERVAS
      console.log(`[DEBUG] Calling reservationService.reserveSpot for ${email}`);
      const reservationResult = await this.reservationService.reserveSpot(
        email, 
        dto.eventId, 
        userData.gender
      );

      // ✅ CRIAR/ATUALIZAR APENAS reservationHistory (formato novo, SEM spots e SEM reservations)
      if (reservationResult.status === 'reserved') {
        // Calcular preço com desconto se aplicável
        let price = eventData?.price || 0;
        const eventDiscount = userData.discount;
        
        if (eventDiscount) {
          const discount = eventDiscount.find(
            (d: any) => d.event === dto.eventId
          );
          if (discount) {
            price = price * (1 - discount.discount);
          }
        }

        // Preparar dados completos da reserva
        const reservationData: any = {
          // Dados da reserva
          ticketKind: dto.ticket_kind,
          status: 'Processando', // Status inicial sempre 'Processando' para novas reservas
          eventId: dto.eventId,
          price: price,
          charges: [], // Array vazio, será preenchido pelos webhooks
          updatedAt: new Date(),

          // Dados completos do usuário
          userId: userDoc.id,
          email: userData.email,
          cpf: userData.cpf,
          name: userData.name,
          userType: userData.userType,
          gender: userData.gender,
          data_nasc: userData.data_nasc,
          idade: userData.idade,
          
          // Dados da igreja
          church: userData.church,
          pastor: userData.pastor,
          
          // Contato
          ddd: userData.ddd,
          cellphone: userData.cellphone,
          
          // Endereço
          cep: userData.cep,
          cidade: userData.cidade,
          estado: userData.estado,
          address: userData.address,
        };

        // Adicionar campos opcionais
        const optionalFields = [
          'complemento', 'responsavel', 'documento_responsavel', 
          'ddd_responsavel', 'cellphone_responsavel', 'alergia', 
          'medicamento', 'info_add', 'discount', 'nomeMae', 'nomePai',
          'contato2', 'contato3', 'alergiaAlimentar', 'alergiaPicadaInsetos',
          'outrasAlergias', 'condicoesSaude', 'medicamentoContinuado',
          'podeAtisFisica', 'transtornosDesenvolvimento', 'autorizaFotosVideos'
        ];

        optionalFields.forEach(field => {
          if (userData[field] !== undefined) {
            reservationData[field] = userData[field];
          }
        });

        // CRIAR novo documento sempre (sem verificação de duplicação por CPF)
        reservationData.createdAt = new Date();
        const newDocRef = await firestore.collection('reservationHistory').add(reservationData);
        console.log(`✅ [CRIADO] Novo documento em reservationHistory para CPF ${userData.cpf} (ID: ${newDocRef.id})`);

        console.log(`[DEBUG] Reserve spot successful:`, {
          ticketKind: dto.ticket_kind,
          email: userData.email,
          eventId: dto.eventId,
          status: reservationResult.status,
          message: reservationResult.message,
        });

        return {
          ticketKind: dto.ticket_kind,
          email: userData.email,
          eventId: dto.eventId,
          status: reservationResult.status,
          message: reservationResult.message,
        };
      } else {
        // Para status queued ou waiting-list, retornar apenas a informação
        console.log(`[INFO] User ${email} added to ${reservationResult.status}`);
        return {
          ticketKind: dto.ticket_kind,
          email: userData.email,
          eventId: dto.eventId,
          status: reservationResult.status,
          message: reservationResult.message,
          position: reservationResult.position,
        };
      }

    } catch (e) {
      console.log(`[DEBUG] Reserve spot error:`, {
        message: e instanceof Error ? e.message : 'Unknown error',
        stack: e instanceof Error ? e.stack : undefined,
        name: e instanceof Error ? e.name : undefined
      });
      
      if (e instanceof BadRequestException) {
        throw e;
      }
      throw new BadRequestException(
        `Erro ao reservar vaga: ${e instanceof Error ? e.message : 'Erro desconhecido'}`
      );
    }
  }

  async getAllReservationsByEvent(eventId: string) {
    const firestore = this.firestoreService.firestore;
    const reservationsQuery = firestore
      .collection('reservationHistory')
      .where('eventId', '==', eventId);

    try {
      const reservationsSnapshot = await reservationsQuery.get();
      if (reservationsSnapshot.empty) {
        throw new NotFoundException('No reservations found for this event');
      }
      return reservationsSnapshot.docs.map((doc) => ({
        uuid: doc.id,
        ...doc.data(),
      }));
    } catch (e) {
      throw new BadRequestException(
        'An error occurred while fetching reservations for the event',
      );
    }
  }

  async getInstallments(eventId: string, email: string) {
    const firestore = this.firestoreService.firestore;
  
    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) throw new NotFoundException('Event not found');
  
    const eventData = eventDoc.data();
    if (!eventData) throw new Error('Event data is missing');
  
    let priceInCents = eventData.price;

    const userRef = firestore.collection('users').where("email", "==", email);
    const userDoc = await userRef.get();

    if (userDoc.empty) throw new NotFoundException('User not found');

    const userData = userDoc.docs[0].data();
    if (!userData) throw new Error('User data is missing');


  
    // Verifica vagas disponíveis (para debug)
    const spotsQuery = firestore.collection('spots').where('eventId', '==', eventId);
    const spotsSnapshot = await spotsQuery.get();
    const occupiedSpots = spotsSnapshot.docs.filter(doc => {
      const status = doc.data().status;
      return status === 'reserved' || status === 'Pago';
    }).length;
  
    let maxSpots = 0;
    if (eventData.eventType === EventType.GENERAL) {
      maxSpots = eventData.maxGeneralSpots;
    } else if (eventData.eventType === EventType.GENDER_SPECIFIC) {
      maxSpots =
        eventData.maxClientMale +
        eventData.maxClientFemale +
        eventData.maxStaffMale +
        eventData.maxStaffFemale;
    }

    // Log para debug
    console.log('DEBUG getInstallments:', {
      eventId,
      eventType: eventData.eventType,
      maxSpots,
      totalSpots: spotsSnapshot.size,
      occupiedSpots,
      availableSpots: maxSpots - occupiedSpots,
      spotStatuses: spotsSnapshot.docs.map(doc => ({
        id: doc.id,
        status: doc.data().status
      }))
    });
  
    // Removida validação de vagas - o endpoint de installments não deve bloquear
    // A validação de vagas deve ser feita apenas no momento da reserva
    // if (occupiedSpots >= maxSpots) throw new BadRequestException('No spots available');
  
    const installmentRates = [
      { installment: 1, rate: 4.38 },
      { installment: 2, rate: 6.92 },
      { installment: 3, rate: 8.19 },
      { installment: 4, rate: 9.46 },
      { installment: 5, rate: 10.73 },
      { installment: 6, rate: 12.00 },
      { installment: 7, rate: 13.27 },
      { installment: 8, rate: 14.54 },
      { installment: 9, rate: 15.81 },
      { installment: 10, rate: 17.08 }
    ];
  
    return installmentRates.map(({ installment, rate }) => {
      const totalWithInterest = priceInCents * (1 + rate / 100);
      const installmentValue = Math.round(totalWithInterest / installment);

      return {
        installmentNumber: installment,
        valueInCents: installmentValue,
        valueWithInterest: `R$ ${(installmentValue / 100).toFixed(2).replace('.', ',')}`
      };
    });
  }
  
  /**
   * Busca as estatísticas de um evento com dados detalhados
   */
  async getEventStats(eventId: string) {
    try {
      // Buscar dados do evento
      const firestore = this.firestoreService.firestore;
      const eventRef = firestore.collection('events').doc(eventId);
      const eventDoc = await eventRef.get();
      
      if (!eventDoc.exists) {
        throw new NotFoundException('Event not found');
      }

      const eventData = eventDoc.data();
      
      // Buscar estatísticas detalhadas do ReservationService
      const stats = await this.reservationService.getEventStats(eventId);
      
      // Determinar o tipo de evento e limites
      let eventTypeInfo = {};
      
      if (eventData.eventType === EventType.GENERAL) {
        eventTypeInfo = {
          eventType: 'general',
          maxGeneralSpots: stats.maxGeneralSpots,
          type: 'general'
        };
      } else if (eventData.eventType === EventType.GENDER_SPECIFIC) {
        eventTypeInfo = {
          eventType: 'gender_specific',
          maxClientMale: stats.maxClientMale,
          maxClientFemale: stats.maxClientFemale,
          maxStaffMale: stats.maxStaffMale,
          maxStaffFemale: stats.maxStaffFemale,
          maxMale: stats.maxClientMale + stats.maxStaffMale,
          maxFemale: stats.maxClientFemale + stats.maxStaffFemale,
          maxTotal: stats.maxClientMale + stats.maxClientFemale + stats.maxStaffMale + stats.maxStaffFemale + stats.maxGeneralSpots,
          type: 'gender_specific'
        };
      }

      const totalOccupied = stats.totalReserved + stats.totalPaid;
      const maxTotal = stats.maxClientMale + stats.maxClientFemale + stats.maxStaffMale + stats.maxStaffFemale + stats.maxGeneralSpots;
      const occupancyPercentage = maxTotal > 0 ? Math.round((totalOccupied / maxTotal) * 100) : 0;

      return {
        eventId,
        eventName: eventData.name,
        eventType: eventData.eventType,
        enableQueueProcessing: eventData.enableQueueProcessing ?? false,
        statistics: {
          totalPaid: stats.totalPaid,
          totalInscritos: stats.totalInscritos, // Total de pessoas que completaram o pagamento
          malePaid: stats.malePaid,
          femalePaid: stats.femalePaid,
          totalReserved: stats.totalReserved,
          maleReserved: stats.maleReserved,
          femaleReserved: stats.femaleReserved,
          totalOccupied,
          availableSpots: stats.vagasDisponiveis.total,
          occupancyPercentage
        },
        limits: eventTypeInfo,
        vagasDisponiveis: stats.vagasDisponiveis,
        updatedAt: new Date().toISOString()
      };

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new BadRequestException(`Erro ao buscar estatísticas do evento: ${errorMessage}`);
    }
  }

    async getWaitingList(eventId: string): Promise<string[]> {
      const waitingListRef = this.firestoreService.firestore
        .collection('waitingList')
        .doc(eventId);
      const waitingListDoc = await waitingListRef.get();
  
      if (waitingListDoc.exists) {
        const waitingListData = waitingListDoc.data();
        // Retorna a lista de e-mails, ou um array vazio se não houver e-mails
        return waitingListData?.emails || [];
      } else {
        // Se o documento não existir, retorna um array vazio
        return [];
      }
    }

  /**
   * Recalcula as estatísticas de um evento
   */
  async recalculateEventStats(eventId: string): Promise<void> {
    return this.reservationService.recalculateEventStats(eventId);
  }
  
  /**
   * Limpa o cache de um evento específico
   */
  async clearEventCache(eventId: string): Promise<void> {
    return this.reservationService.clearEventCache(eventId);
  }
  
  /**
   * Limpa todo o cache
   */
  async clearAllCache(): Promise<void> {
    return this.reservationService.clearAllCache();
  }
  
  /**
   * Controle manual dos jobs de limpeza
   */
  async forceStartJobs(): Promise<void> {
    return this.reservationService.forceStartJobs();
  }
  
  async forceStopJobs(): Promise<void> {
    return this.reservationService.forceStopJobs();
  }
  
  async getJobsStatus(): Promise<any> {
    return this.reservationService.getJobsStatus();
  }
  
  /**
   * Limpeza de dados antigos com status 'expired'
   */
  async cleanupLegacyData(): Promise<void> {
    return this.reservationService.cleanupLegacyData();
  }
  }