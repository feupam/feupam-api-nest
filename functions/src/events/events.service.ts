import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FirestoreService } from '../firebase/firebase.service';
import { EventType, UserType, Gender } from './dto/enum';
import { TicketStatus, SpotStatus } from './dto/enum-spot';
import { ReserveSpotDto } from './dto/reserve-spot.dto';
import { Timestamp } from 'firebase-admin/firestore';
import * as moment from 'moment-timezone';

@Injectable()
export class EventsService {
  constructor(private readonly firestoreService: FirestoreService) {}

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
    const email = 'test@test.com';
    const firestore = this.firestoreService.firestore;

    try {
      // Verifique se o evento existe
      const eventRef = firestore.collection('events').doc(eventId);
      const eventDoc = await eventRef.get();
      if (!eventDoc.exists) {
        throw new NotFoundException('Event not found');
      }

      const eventData = eventDoc.data();
      if (!eventData) {
        throw new NotFoundException('Event data is missing');
      }

      // Contagem de spots existentes para o evento
      const spotsQuery = firestore
        .collection('spots')
        .where('eventId', '==', eventId);
      const spotsSnapshot = await spotsQuery.get();

      const spotsCount = {
        clientMale: 0,
        clientFemale: 0,
        staffMale: 0,
        staffFemale: 0,
      };

      spotsSnapshot.docs.forEach((doc) => {
        const spot = doc.data();
        if (eventData.eventType === EventType.GENDER_SPECIFIC) {
          if (spot.gender === Gender.MALE) {
            if (spot.userType === UserType.CLIENT) {
              spotsCount.clientMale += 1;
            } else if (spot.userType === UserType.STAFF) {
              spotsCount.staffMale += 1;
            }
          } else if (spot.gender === Gender.FEMALE) {
            if (spot.userType === UserType.CLIENT) {
              spotsCount.clientFemale += 1;
            } else if (spot.userType === UserType.STAFF) {
              spotsCount.staffFemale += 1;
            }
          }
        } else {
          // Para eventos do tipo GENERAL, contagem total
          if (spot.userType === UserType.CLIENT) {
            spotsCount.clientMale += 1; // Usando uma contagem unificada
          } else if (spot.userType === UserType.STAFF) {
            spotsCount.staffMale += 1;
          }
        }
      });
      // Verifique se as reservas excedem os limites por gênero e tipo
      if (
        (eventData.eventType === EventType.GENDER_SPECIFIC &&
          (spotsCount.clientMale >= eventData.maxClientMale ||
            spotsCount.clientFemale >= eventData.maxClientFemale ||
            spotsCount.staffMale >= eventData.maxStaffMale ||
            spotsCount.staffFemale >= eventData.maxStaffFemale)) ||
        (eventData.eventType === EventType.GENERAL &&
          spotsCount.clientMale + spotsCount.clientFemale >=
            eventData.maxGeneralSpots)
      ) {
        const waitingListRef = firestore.collection('waitingList').doc(eventId);
        const waitingListDoc = await waitingListRef.get();

        if (waitingListDoc.exists) {
          // Se o documento existe, atualize a lista de e-mails
          const waitingListData = waitingListDoc.data();
          const existingEmails = waitingListData?.emails || [];

          if (!existingEmails.includes(email)) {
            // Adiciona o novo e-mail e atualiza o documento
            const updatedEmails = [...existingEmails, email];
            await waitingListRef.set(
              { emails: updatedEmails },
              { merge: true },
            );
          }
        } else {
          // Se o documento não existe, crie um novo com a lista de e-mails
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
      const batch = firestore.batch();

      const userRecord = firestore
        .collection('users')
        .where('email', '==', email)
        .get();
      const userDoc = (await userRecord).docs[0];
      const userData = userDoc.data();


        // Verifique se o usuário já tem uma reserva
        const userReservationsQuery = firestore
          .collection('reservationHistory')
          .where('email', '==', email)
          .where('eventId', '==', dto.eventId);
        const userReservationsSnapshot = await userReservationsQuery.get();

        let existingReservation = null;

        if (!userReservationsSnapshot.empty) {
          userReservationsSnapshot.forEach((doc) => {
            const reservation = doc.data();
            if (reservation.status !== 'cancelled') {
              throw new BadRequestException(
                'User already has a reservation for this event',
              );
            } else {
              existingReservation = doc; // Reserva cancelada encontrada
            }
          });
        }

        // Criação de um novo spot
        const newSpotRef = firestore.collection('spots').doc();
        const newSpot = {
          eventId: dto.eventId,
          status: SpotStatus.reserved,
          gender: userData.gender || Gender.MALE,
          userType: userData.userType,
        };
        batch.set(newSpotRef, newSpot);

        if (existingReservation) {
          // Atualize a reserva existente
          batch.update(existingReservation.ref, {
            spotId: newSpotRef.id,
            status: TicketStatus.reserved,
            updatedAt: new Date(),
          });
        } else {
          const eventRef = firestore.collection('events').doc(dto.eventId);
          const eventDoc = await eventRef.get();
          if (!eventDoc.exists) {
            throw new NotFoundException('Event not found');
          }
          const eventData = eventDoc.data();

          if (!eventData) {
            throw new Error('Event data is missing');
          }
        
          let price = eventData.price;
          const eventDiscount = userData.discount
          let d;
          if (userData.discount) {
            d = eventDiscount.find(
              (discount) => discount.event === dto.eventId
            );
          }
          if (eventDiscount) {
            price = price * (1 - d.discount);
          }

          const reservationRef = firestore
            .collection('reservationHistory')
            .doc();
          batch.set(reservationRef, {
            spotId: newSpotRef.id,
            ticketKind: dto.ticket_kind,
            email: userData.email,
            status: TicketStatus.available,
            userType: userData.userType,
            gender: newSpot.gender,
            eventId: dto.eventId,
            price: price,
          });
        }

        await batch.commit();
        return {
          spotId: newSpotRef.id,
          ticketKind: dto.ticket_kind,
          email: userData.email,
          eventId: dto.eventId,
        };

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
  
    let priceInCents = 27375//eventData.price;

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
      { installment: 1, rate: 0.00 },
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