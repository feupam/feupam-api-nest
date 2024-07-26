import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ReserveSpotForStaffDto } from './dto/reserve-spot-for-staff.dto';
import { SpotStatus, TicketStatus } from '../spots/dto/enum';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(private firestoreService: FirestoreService) {}

  async create(createStaffDto: CreateStaffDto) {
    const staffRef = this.firestoreService.firestore.collection('staff').doc();
    await staffRef.set(createStaffDto);
    return { id: staffRef.id, ...createStaffDto };
  }

  async findAll() {
    const snapshot = await this.firestoreService.firestore
      .collection('staff')
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findOne(id: string) {
    const staffRef = this.firestoreService.firestore
      .collection('staff')
      .doc(id);
    const doc = await staffRef.get();
    if (!doc.exists) {
      throw new NotFoundException('Staff not found');
    }
    return { id: doc.id, ...doc.data() };
  }

  async update(id: string, updateStaffDto: UpdateStaffDto) {
    const staffRef = this.firestoreService.firestore
      .collection('staff')
      .doc(id);

    // Verifique se o staffRef realmente existe antes de tentar atualizar
    const staffDoc = await staffRef.get();
    if (!staffDoc.exists) {
      throw new Error('Staff not found');
    }

    // Converta o DTO para um objeto simples
    const updateData = {
      ...updateStaffDto,
    };

    await staffRef.update(updateData);

    return { id, ...updateData };
  }

  async remove(id: string) {
    const staffRef = this.firestoreService.firestore
      .collection('staff')
      .doc(id);
    await staffRef.delete();
    return { id };
  }

  async reserveSpotForStaff(dto: ReserveSpotForStaffDto) {
    const staffRef = this.firestoreService.firestore
      .collection('staff')
      .doc(dto.staffId);
    const staffDoc = await staffRef.get();
    if (!staffDoc.exists) {
      throw new NotFoundException('Staff not found');
    }

    // Check if the total number of reserved spots (both user and staff) for the event exceeds the limit
    const totalReservedSpots = await this.getTotalReservedSpots(dto.eventId);
    const spotsSnapshot = await this.firestoreService.firestore
      .collection('spots')
      .where('eventId', '==', dto.eventId)
      .where('type', '==', 'staff_spot')
      .where('name', 'in', dto.spots)
      .get();

    const spots = spotsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    if (spots.length !== dto.spots.length) {
      const foundSpotsName = spots.map((spot) => spot.id);
      const notFoundSpotsName = dto.spots.filter(
        (spotName) => !foundSpotsName.includes(spotName),
      );
      throw new NotFoundException(
        `Spots ${notFoundSpotsName.join(', ')} not found`,
      );
    }

    const reservedSpotsCount = spots.length;
    if (totalReservedSpots + reservedSpotsCount > 100) {
      throw new ConflictException(
        'The maximum number of spots for this event has been reached.',
      );
    }

    const batch = this.firestoreService.firestore.batch();

    spots.forEach((spot) => {
      const reservationHistoryRef = this.firestoreService.firestore
        .collection('reservationHistory')
        .doc();
      batch.set(reservationHistoryRef, {
        spotId: spot.id,
        ticketKind: dto.ticket_kind,
        email: dto.email,
        status: TicketStatus.reserved,
      });

      const spotRef = this.firestoreService.firestore
        .collection('spots')
        .doc(spot.id);
      batch.update(spotRef, { status: SpotStatus.reserved });
    });

    const ticketRefs = spots.map((spot) => {
      const ticketRef = this.firestoreService.firestore
        .collection('tickets')
        .doc();
      batch.set(ticketRef, {
        spotId: spot.id,
        ticketKind: dto.ticket_kind,
        email: dto.email,
      });
      return ticketRef;
    });

    try {
      await batch.commit();
      const tickets = await Promise.all(
        ticketRefs.map((ref) =>
          ref.get().then((doc) => ({ id: doc.id, ...doc.data() })),
        ),
      );
      return tickets;
    } catch (e) {
      console.log('Error during reservation');
      console.log(e);
      throw e;
    }
  }

  private async getTotalReservedSpots(eventId: string): Promise<number> {
    const userSpotsSnapshot = await this.firestoreService.firestore
      .collection('reservationHistory')
      .where('eventId', '==', eventId)
      .where('spotType', '==', 'user_spot')
      .count()
      .get();

    const staffSpotsSnapshot = await this.firestoreService.firestore
      .collection('reservationHistory')
      .where('eventId', '==', eventId)
      .where('spotType', '==', 'staff_spot')
      .count()
      .get();

    // Contar o número de documentos em cada snapshot
    const userSpotsCount = userSpotsSnapshot.data.length;
    const staffSpotsCount = staffSpotsSnapshot.data.length;

    // Retornar a soma total de spots reservados
    return userSpotsCount + staffSpotsCount;
  }
}
