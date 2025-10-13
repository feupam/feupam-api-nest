import { Injectable } from '@nestjs/common';
import { ReservationService } from '../reservation/reservation.service';
import { FirestoreService } from '../firebase/firebase.service';

@Injectable()
export class TicketService {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly firestoreService: FirestoreService,
  ) {}

  async purchaseTicket(eventId: string, email: string) {
    console.log(`[DEBUG] purchaseTicket started for email: ${email}, eventId: ${eventId}`);
    
    // Verificar se o usuário existe e obter o gênero
    const usersRef = await this.firestoreService.firestore
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersRef.empty) {
      throw new Error('Usuário não encontrado.');
    }

    const userData = usersRef.docs[0].data();
    const gender = userData.gender;

    if (!['male', 'female'].includes(gender)) {
      throw new Error('Gênero não especificado corretamente no perfil do usuário.');
    }

    console.log(`[DEBUG] User found with gender: ${gender}`);

    try {
      // Verificar o status da reserva no novo sistema
      console.log(`[DEBUG] Calling getReservationStatus...`);
      const reservationStatus = await this.reservationService.getReservationStatus(email, eventId);
      console.log(`[DEBUG] getReservationStatus result:`, reservationStatus);

      if (reservationStatus.status === 'none') {
        // Se não há reserva, tentar criar uma nova
        console.log(`[DEBUG] No reservation found, calling reserveSpot...`);
        const result = await this.reservationService.reserveSpot(email, eventId, gender);
        console.log(`[DEBUG] reserveSpot result:`, result);
        
        // Verificar se a reserva foi criada checando o banco novamente
        console.log(`[DEBUG] Verifying reservation was created...`);
        const verifyStatus = await this.reservationService.getReservationStatus(email, eventId);
        console.log(`[DEBUG] Verification status:`, verifyStatus);
        
        return result;
      } else if (reservationStatus.status === 'reserved') {
        // Tem uma reserva válida, pode proceder com o pagamento
        return {
          status: 'reserved',
          message: 'Reserva válida. Pode proceder com o pagamento.',
          expiresAt: reservationStatus.expiresAt,
          remainingMinutes: reservationStatus.remainingMinutes
        };
      } else if (reservationStatus.status === 'Pago') {
        return {
          status: 'already-paid',
          message: 'Você já pagou a sua inscrição.'
        };
      } else {
        // Para status 'queued' ou 'waiting-list'
        return {
          status: reservationStatus.status,
          message: reservationStatus.status === 'queued' 
            ? `Você está na fila. Posição: ${reservationStatus.position}` 
            : 'Você está na lista de espera.',
          position: reservationStatus.position
        };
      }
    } catch (error) {
      console.log(`[DEBUG] Error in purchaseTicket:`, error);
      throw error;
    }
  }

  async processQueue(eventId: string) {
    // Delegar para o ReservationService
    await this.reservationService.processQueue(eventId);
  }

  async getReservationStatus(eventId: string, email: string) {
    // Usar o novo sistema para verificar status
    const status = await this.reservationService.getReservationStatus(email, eventId);
    
    // Mapear para o formato esperado pelo frontend
    return {
      status: status.status,
      expiresAt: status.expiresAt?.toISOString(),
      currentTime: new Date().toISOString(),
      remainingMinutes: status.remainingMinutes || 0,
    };
  }

  // Método de compatibilidade - pode ser removido no futuro
  async checkReservationStatus(
    exists: string,
    reservationKey: string,
    email: string,
    eventId: string,
  ): Promise<{
    status: 'reserved' | 'queued' | 'waiting-list' | 'Pago';
    expiresAt: string;
    currentTime: string;
    remainingMinutes: number;
  }> {
    // Redirecionar para o novo método
    const status = await this.getReservationStatus(eventId, email);
    return {
      status: status.status as any,
      expiresAt: status.expiresAt || new Date().toISOString(),
      currentTime: status.currentTime,
      remainingMinutes: status.remainingMinutes,
    };
  }
}
