import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FirestoreService } from '../firebase/firebase.service';
import { ReservationService } from '../reservation/reservation.service';
import { EventType, Gender } from './dto/enum';
import { TicketStatus, SpotStatus } from './dto/enum-spot';
import { ReserveSpotDto } from './dto/reserve-spot.dto';
import { Timestamp } from 'firebase-admin/firestore';
import * as moment from 'moment-timezone';

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

    await eventRef.update({
      ...updateEventDto,
      date: new Date().toISOString(),
    });

    return { uuid, ...updateEventDto };
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
        location: data.location,
        startDate: data.startDate,
        endDate: data.endDate,
        price: data.price,
        isOpen,
         image_capa: data.image_capa || null,
         logo_evento: data.logo_evento || null,
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
      const firestore = this.firestoreService.firestore;

      // Buscar dados do usuário
      const userRecord = firestore
        .collection('users')
        .where('email', '==', email)
        .get();
      const userDoc = (await userRecord).docs[0];
      const userData = userDoc.data();

      if (!userData || !['male', 'female'].includes(userData.gender)) {
        throw new BadRequestException('Usuário não encontrado ou gênero não especificado');
      }

      // Verificar se já tem reserva para este evento
      const userReservationsQuery = firestore
        .collection('reservationHistory')
        .where('email', '==', email)
        .where('eventId', '==', dto.eventId);
      const userReservationsSnapshot = await userReservationsQuery.get();

      if (!userReservationsSnapshot.empty) {
        const hasActiveReservation = userReservationsSnapshot.docs.some(doc => {
          const reservation = doc.data();
          return reservation.status !== 'cancelled';
        });

        if (hasActiveReservation) {
          throw new BadRequestException('User already has a reservation for this event');
        }
      }

      // Usar o novo sistema de reservas
      const reservationResult = await this.reservationService.reserveSpot(
        email, 
        dto.eventId, 
        userData.gender
      );

      // Se conseguiu reservar, criar os registros no formato antigo para compatibilidade
      if (reservationResult.status === 'reserved') {
        const batch = firestore.batch();

        // Criar spot (mantendo compatibilidade)
        const newSpotRef = firestore.collection('spots').doc();
        const newSpot = {
          eventId: dto.eventId,
          status: SpotStatus.reserved,
          gender: userData.gender || Gender.MALE,
          userType: userData.userType,
        };
        batch.set(newSpotRef, newSpot);

        // Buscar dados do evento para o preço
        const eventRef = firestore.collection('events').doc(dto.eventId);
        const eventDoc = await eventRef.get();
        if (!eventDoc.exists) {
          throw new NotFoundException('Event not found');
        }
        const eventData = eventDoc.data();

        let price = eventData?.price;
        const eventDiscount = userData.discount;
        let d;
        if (userData.discount) {
          d = eventDiscount.find(
            (discount) => discount.event === dto.eventId
          );
        }
        if (eventDiscount && d) {
          price = price * (1 - d.discount);
        }

        // Criar reservationHistory (mantendo compatibilidade)
        const reservationRef = firestore.collection('reservationHistory').doc();
        batch.set(reservationRef, {
          spotId: newSpotRef.id,
          ticketKind: dto.ticket_kind,
          email: userData.email,
          status: TicketStatus.available,
          userType: userData.userType,
          gender: userData.gender,
          eventId: dto.eventId,
          price: price,
        });

        await batch.commit();

        return {
          spotId: newSpotRef.id,
          ticketKind: dto.ticket_kind,
          email: userData.email,
          eventId: dto.eventId,
          status: reservationResult.status,
          message: reservationResult.message,
        };
      } else {
        // Para status queued ou waiting-list, retornar apenas a informação
        return {
          spotId: null,
          ticketKind: dto.ticket_kind,
          email: userData.email,
          eventId: dto.eventId,
          status: reservationResult.status,
          message: reservationResult.message,
          position: reservationResult.position,
        };
      }

    } catch (e) {
      if (e instanceof Error) {
        throw e;
      } else {
        throw new Error(`Unknown error: ${e}`);
      }
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


  
    // Verifica vagas disponíveis
    const spotsQuery = firestore.collection('spots').where('eventId', '==', eventId);
    const spotsSnapshot = await spotsQuery.get();
    const reservedSpots = spotsSnapshot.docs.filter(doc => doc.data().status === 'reserved').length;
  
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
  
    if (reservedSpots >= maxSpots) throw new BadRequestException('No spots available');
  
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
  
 async getEventStats(eventId: string) {
    const firestore = this.firestoreService.firestore;

    try {
      // Buscar dados do evento
      const eventRef = firestore.collection('events').doc(eventId);
      const eventDoc = await eventRef.get();
      
      if (!eventDoc.exists) {
        throw new NotFoundException('Event not found');
      }

      const eventData = eventDoc.data();

      // Buscar estatísticas do evento
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

      // Calcular totais
      const totalOccupied = (currentStats.totalPaid || 0) + (currentStats.totalReserved || 0);
      
      // Determinar limites máximos baseado no tipo do evento
      let maxSpots = 0;
      let limits = {};
      
      if (eventData.eventType === EventType.GENERAL) {
        maxSpots = parseInt(eventData.maxGeneralSpots) || 0;
        limits = {
          maxGeneralSpots: maxSpots,
          type: 'general'
        };
      } else if (eventData.eventType === EventType.GENDER_SPECIFIC) {
        const maxClientMale = parseInt(eventData.maxClientMale) || 0;
        const maxClientFemale = parseInt(eventData.maxClientFemale) || 0;
        const maxStaffMale = parseInt(eventData.maxStaffMale) || 0;
        const maxStaffFemale = parseInt(eventData.maxStaffFemale) || 0;
        
        maxSpots = maxClientMale + maxClientFemale + maxStaffMale + maxStaffFemale;
        limits = {
          maxClientMale,
          maxClientFemale,
          maxStaffMale,
          maxStaffFemale,
          maxMale: maxClientMale + maxStaffMale,
          maxFemale: maxClientFemale + maxStaffFemale,
          maxTotal: maxSpots,
          type: 'gender_specific'
        };
      }

      const availableSpots = Math.max(0, maxSpots - totalOccupied);
      const occupancyPercentage = maxSpots > 0 ? Math.round((totalOccupied / maxSpots) * 100) : 0;

      return {
        eventId,
        eventName: eventData.name,
        eventType: eventData.eventType,
        enableQueueProcessing: eventData.enableQueueProcessing ?? false,
        statistics: {
          totalPaid: currentStats.totalPaid || 0,
          malePaid: currentStats.malePaid || 0,
          femalePaid: currentStats.femalePaid || 0,
          totalReserved: currentStats.totalReserved || 0,
          maleReserved: currentStats.maleReserved || 0,
          femaleReserved: currentStats.femaleReserved || 0,
          totalOccupied,
          availableSpots,
          occupancyPercentage
        },
        limits,
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
  }