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
import ExcelJS from 'exceljs';

@Injectable()
export class EventsService {
  constructor(private readonly firestoreService: FirestoreService) {}

  async create(dto: CreateEventDto) {
    const firestore = this.firestoreService.firestore;

    // Usar o nome do evento como ID
    const eventId = dto.name;

    // Referência do documento usando o nome como ID
    const eventRef = firestore.collection('events').doc(eventId);

    // Dados do evento incluindo tipo e vagas
    const eventData = {
      name: dto.name,
      date: dto.date,
      location: dto.location,
      eventType: dto.eventType,
      maxClientMale: dto.maxClientMale || 0,
      maxClientFemale: dto.maxClientFemale || 0,
      maxStaffMale: dto.maxStaffMale || 0,
      maxStaffFemale: dto.maxStaffFemale || 0,
      maxGeneralSpots: dto.maxGeneralSpots || 0, // Para eventos de vagas gerais
      startDate: dto.startDate,
      endDate: dto.endDate,
    };

    try {
      await eventRef.set(eventData);
      return { id: eventRef.id, ...eventData };
    } catch (e) {
      throw new BadRequestException(
        'An error occurred while creating the event',
      );
    }
  }

  async findAll() {
    const snapshot = await this.firestoreService.firestore
      .collection('events')
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findOne(id: string) {
    const eventRef = this.firestoreService.firestore
      .collection('events')
      .doc(id);
    const doc = await eventRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Event not found');
    }
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, updateEventDto: UpdateEventDto) {
    const eventRef = this.firestoreService.firestore
      .collection('events')
      .doc(id);
    await eventRef.update({
      ...updateEventDto,
      date: new Date(updateEventDto.date),
    });
    return { id, ...updateEventDto };
  }

  async remove(id: string) {
    const eventRef = this.firestoreService.firestore
      .collection('events')
      .doc(id);
    await eventRef.delete();
    return { id };
  }

  async checkRegistrationStatus(id: string) {
    const eventRef = this.firestoreService.firestore
      .collection('events')
      .doc(id);
    const doc = await eventRef.get();

    if (!doc.exists) {
      throw new NotFoundException('Event not found');
    }

    const eventData = doc.data();

    if (!eventData) {
      throw new NotFoundException('Event data is missing');
    }

    const currentDate = new Date();

    // Verifique se startDate e endDate são do tipo Timestamp
    const startDate =
      eventData.startDate instanceof Timestamp
        ? eventData.startDate.toDate()
        : new Date(eventData.startDate);

    const endDate =
      eventData.endDate instanceof Timestamp
        ? eventData.endDate.toDate()
        : new Date(eventData.endDate);

    const isOpen = currentDate >= startDate && currentDate <= endDate;

    return { currentDate, isOpen };
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
      userType: UserType;
      gender?: Gender;
    },
  ) {
    try {
      const firestore = this.firestoreService.firestore;
      const batch = firestore.batch();

      const has_spot = await this.checkSpot(dto.eventId);
      if (has_spot) {
        // Verifique se o usuário já tem uma reserva
        const userReservationsQuery = firestore
          .collection('reservationHistory')
          .where('email', '==', dto.email)
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
          gender: dto.gender || Gender.MALE,
          userType: dto.userType,
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
          // Criação de uma nova reserva
          const reservationRef = firestore
            .collection('reservationHistory')
            .doc();
          batch.set(reservationRef, {
            spotId: newSpotRef.id,
            ticketKind: dto.ticket_kind,
            email: dto.email,
            status: TicketStatus.reserved,
            userType: dto.userType,
            gender: newSpot.gender,
            eventId: dto.eventId,
          });
        }

        // Criação de um novo ticket
        const ticketRef = firestore.collection('tickets').doc();
        batch.set(ticketRef, {
          spotId: newSpotRef.id,
          ticketKind: dto.ticket_kind,
          email: dto.email,
          eventId: dto.eventId,
        });

        await batch.commit();
        return {
          spotId: newSpotRef.id,
          ticketKind: dto.ticket_kind,
          email: dto.email,
          eventId: dto.eventId,
        };
      } else {
        throw new BadRequestException('Você entrou para lista de espera');
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
        id: doc.id,
        ...doc.data(),
      }));
    } catch (e) {
      throw new BadRequestException(
        'An error occurred while fetching reservations for the event',
      );
    }
  }

  async getInstallments(eventId: string) {
    const firestore = this.firestoreService.firestore;

    // Verifique se o evento existe
    const eventRef = firestore.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      throw new NotFoundException('Event not found');
    }

    const eventData = eventDoc.data();
    if (!eventData) {
      throw new Error('Event data is missing');
    }

    // Verifique se há vagas disponíveis
    const spotsQuery = firestore
      .collection('spots')
      .where('eventId', '==', eventId);
    const spotsSnapshot = await spotsQuery.get();
    const reservedSpots = spotsSnapshot.docs.filter(
      (doc) => doc.data().status === 'reserved',
    ).length;

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

    if (reservedSpots >= maxSpots) {
      throw new BadRequestException('No spots available for this event');
    }

    // Tabela de juros
    const interestRates = [
      0.0454, 0.0266, 0.0399, 0.0532, 0.0665, 0.0789, 0.0937, 0.1064, 0.1197,
      0.133,
    ];
    const maxInstallments = 10;
    const installmentOptions = [];

    for (let i = 1; i <= maxInstallments; i++) {
      const interestRate = interestRates[i - 1];
      installmentOptions.push({
        installmentNumber: i,
        interestRate: interestRate,
      });
    }

    return installmentOptions;
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

  async generateExcelFile(reservations: any[]): Promise<ExcelJS.Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório');
    // Define columns
    worksheet.columns = [
      { header: 'Gender', key: 'gender', width: 15 },
      { header: 'Ticket Kind', key: 'ticketKind', width: 20 },
      { header: 'User Type', key: 'userType', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
    ];
    // Add rows
    reservations.forEach((reservation) => {
      worksheet.addRow({
        gender: reservation.gender,
        ticketKind: reservation.ticketKind,
        userType: reservation.userType,
        email: reservation.email,
        status: reservation.status,
      });
    });

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}
