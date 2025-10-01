import { BadRequestException, Injectable } from '@nestjs/common';
import { ChargeDto } from './dto/create-payment.dto';
import { Queries } from './queries';
import { Pagarme } from './pagarme';
import { BuildBody } from './build-body';
import { FirestoreService } from '../firebase/firebase.service';
import { ReservationService } from '../reservation/reservation.service';
import { TicketService } from '../ticket/ticket.service';
import { FieldValue } from 'firebase-admin/firestore';

@Injectable()
export class PaymentService {
  constructor(
    private readonly firestoreService: FirestoreService,
    private readonly reservationService: ReservationService,
    private readonly ticketService: TicketService,
  ) {}

  async payment(req: any, email: string): Promise<ChargeDto> {
    try {
      const queriesService = new Queries(this.firestoreService);
      const pagarmeService = new Pagarme();
      const user = await queriesService.getUserByEmail(email);
      
      // O eventId vem da requisição do frontend
      const eventId = req.items[0].description;
      
      if (!eventId) {
        throw new Error('EventId é obrigatório');
      }
      
      // Buscar o evento para obter o preço correto
      const eventDoc = await this.firestoreService.firestore
        .collection('events')
        .doc(eventId)
        .get();
      
      if (!eventDoc.exists) {
        throw new Error('Evento não encontrado');
      }
      
      const eventData = eventDoc.data();
      // O preço no banco já está em centavos, não precisa converter
      const VALOR_DO_EVENTO = eventData.price || 36500;
      
      console.log(`[PaymentService] Evento: ${eventId}`);
      console.log(`[PaymentService] Preço do evento: ${VALOR_DO_EVENTO} centavos (R$ ${(VALOR_DO_EVENTO/100).toFixed(2)})`);
      console.log(`[PaymentService] Valor enviado: ${req.items[0].amount} centavos (R$ ${(req.items[0].amount/100).toFixed(2)})`);
      
      // Verificar se existe reserva ativa para esse evento específico
      const reservationStatus = await this.reservationService.getReservationStatus(email, eventId);
      if (reservationStatus.status !== 'reserved' && reservationStatus.status !== 'paid') {
        throw new Error('Sua reserva expirou. Por favor, tente novamente.');
      }
      
      const bodyPagarme = this.buildRequestBody(req, user[0]);

      // Verificar se já existe um pagamento para este usuário/evento
      const existingReservation =
        await queriesService.getReservationByEmailAndEvent(email, eventId);

      if (
        existingReservation[0]?.eventId === eventId &&
        existingReservation[0]?.status === 'Pago'
      ) {
        throw new Error('usuario ja comprou');
      }

      const itemAmount = bodyPagarme.items[0].amount;

      if (itemAmount < VALOR_DO_EVENTO) {
        throw new Error('Valor menor que o ingresso');
      }

      const response = await pagarmeService.createPayment(bodyPagarme);

      let payLink: string = '';
      if (response.charges[0].payment_method === 'credit_card') {
        payLink = response.charges[0].last_transaction.acquirer_message;
      } else if (response.charges[0].payment_method === 'boleto') {
        payLink = response.charges[0].last_transaction.pdf;
      } else if (response.charges[0].payment_method === 'pix') {
        payLink = response.charges[0].last_transaction.qr_code;
      } else {
        throw new Error('Meio de pagamento não cadastrado');
      }

      let status: string = '';
      if (response.status == 'paid') {
        status = 'Pago';
      } else if (response.status == 'pending') {
        status = 'Processando';
      } else {
        status = response.status;
      }

      const charge: ChargeDto = {
        event: response.items[0].description,
        status: status,
        amount: response.items[0].amount,
        payLink: payLink,
        qrcodePix: response.charges[0].last_transaction.qr_code_url ?? '',
        meio: response.charges[0].payment_method,
        email: response.customer.email,
        lote: 0,
        envioWhatsapp: false,
        chargeId: response.charges[0].id,
      };

      // Atualizar status da reserva e confirmar pagamento em uma única transação
      if (response.status == 'paid') {
        await this.confirmPaymentAndUpdateReservation(email, eventId, charge, status);
      } else {
        await queriesService.updateReservationStatus(charge, status);
      }

      return charge;
    } catch (error) {
      throw new BadRequestException(`Pagarme2: ${error}`);
    }
  }

  public buildRequestBody(req: any, user: any): any {
    const buildBody = new BuildBody();
    switch (req.payments.payment_method) {
      case 'credit_card':
        return buildBody.creditBody(req, user);
      case 'boleto':
        return buildBody.boletoBody(req, user);
      case 'pix':
        return buildBody.pixBody(req, user);
      default:
        throw new Error('Tipo de pagamento não cadastrado');
    }
  }

  public getPayLink(charge: any): string {
    switch (charge.payment_method) {
      case 'credit_card':
        return charge.last_transaction.acquirer_message;
      case 'boleto':
        return charge.last_transaction.pdf;
      case 'pix':
        return charge.last_transaction.qr_code;
      default:
        throw new Error('Meio de pagamento não cadastrado');
    }
  }

  public getStatus(status: string): string {
    switch (status) {
      case 'paid':
        return 'Pago';
      case 'pending':
        return 'Processando';
      default:
        return status;
    }
  }

  async handlePagarmeWebhook(body: any) {
    const queriesService = new Queries(this.firestoreService);
    const webhookData = body.data;

    console.log('🎯 Webhook PagarMe recebido:', {
      status: webhookData.status,
      email: webhookData.customer?.email,
      id: webhookData.id,
      amount: webhookData.amount
    });

    // Mapear status do PagarMe para status interno
    const statusMapping = {
      'paid': 'Pago',
      'pending': 'Processando', 
      'processing': 'Processando',
      'authorized': 'Processando',
      'canceled': 'Cancelado',
      'failed': 'Falhou',
      'refunded': 'Reembolsado',
      'refused': 'Recusado'
    };

    const internalStatus = statusMapping[webhookData.status] || 'Processando';
    
    try {
      // Obter eventId do histórico de reservas
      const eventId = await this.getEventIdFromReservation(webhookData.customer.email);
      
      // Criar um charge DTO básico para o webhook
      const charge: ChargeDto = {
        event: eventId,
        status: internalStatus,
        amount: webhookData.amount,
        payLink: '',
        qrcodePix: '',
        meio: webhookData.payment_method || 'webhook',
        email: webhookData.customer.email,
        lote: 0,
        envioWhatsapp: false,
        chargeId: webhookData.id,
      };

      // Se for pago, fazer o processo completo
      if (webhookData.status === 'paid') {
        await this.confirmPaymentAndUpdateReservation(
          webhookData.customer.email,
          eventId,
          charge,
          internalStatus
        );

        // Processar fila após confirmação do pagamento
        await this.ticketService.processQueue(eventId);
      } else {
        // Para outros status, atualizar tanto o status da reserva quanto do charge
        await this.updateReservationAndChargeStatus(
          webhookData.customer.email,
          eventId,
          charge,
          internalStatus
        );
      }

      console.log('✅ Webhook processado com sucesso:', { 
        email: webhookData.customer.email, 
        status: internalStatus 
      });
      
    } catch (error: any) {
      console.error('❌ Erro no webhook:', error);
      // Se falhar a confirmação da reserva, pelo menos atualizar o status do charge
      await queriesService.updateChargeStatus(
        webhookData.customer.email,
        webhookData.id,
        internalStatus,
      );
    }

    return { message: 'ok', status: internalStatus };
  }

  private async getEventIdFromReservation(email: string): Promise<string> {
    const snapshot = await this.firestoreService.firestore
      .collection('reservationHistory')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new Error('Reserva não encontrada para obter eventId');
    }

    return snapshot.docs[0].data().eventId;
  }

  /**
   * Atualiza AMBOS os status: da reserva principal E do charge
   */
  private async updateReservationAndChargeStatus(
    email: string, 
    eventId: string, 
    charge: ChargeDto, 
    status: string
  ): Promise<void> {
    const db = this.firestoreService.firestore;
    
    await db.runTransaction(async (transaction) => {
      // 1. Buscar o histórico de reserva para atualizar
      const historyRef = db
        .collection('reservationHistory')
        .where('email', '==', email)
        .where('eventId', '==', eventId);
      
      const historySnapshot = await transaction.get(historyRef);
      
      if (historySnapshot.empty) {
        throw new Error('Histórico de reserva não encontrado');
      }

      // 2. Atualizar o histórico com o charge e novo status
      const historyDoc = historySnapshot.docs[0];
      const historyData = historyDoc.data();
      const updatedCharges = historyData?.charges || [];
      
      // Verificar se já existe um charge com esse ID
      const existingChargeIndex = updatedCharges.findIndex(
        (c: any) => c.chargeId === charge.chargeId
      );
      
      if (existingChargeIndex >= 0) {
        // Atualizar charge existente
        updatedCharges[existingChargeIndex] = charge;
      } else {
        // Adicionar novo charge
        updatedCharges.push(charge);
      }

      // 3. Atualizar AMBOS os status:
      //    - Status da reserva principal (nível superior)
      //    - Status do charge (dentro do array)
      transaction.update(historyDoc.ref, {
        charges: updatedCharges,
        status: status, // ← Status da reserva principal
        updatedAt: new Date(),
      });

      console.log('✅ Status da reserva E charge atualizados:', { 
        email, 
        eventId, 
        status,
        chargeId: charge.chargeId
      });
    });
  }

  /**
   * Confirma o pagamento no sistema de reservas e atualiza o histórico em uma única transação
   */
  private async confirmPaymentAndUpdateReservation(
    email: string, 
    eventId: string, 
    charge: ChargeDto, 
    status: string
  ): Promise<void> {
    const db = this.firestoreService.firestore;
    
    await db.runTransaction(async (transaction) => {
      // 1. Buscar e atualizar a reserva ativa
      const reservationRef = db
        .collection('reservations')
        .where('email', '==', email)
        .where('eventId', '==', eventId)
        .where('status', '==', 'reserved');
      
      const reservationSnapshot = await transaction.get(reservationRef);
      
      if (reservationSnapshot.empty) {
        throw new Error('Reserva não encontrada ou já processada');
      }

      const reservationDoc = reservationSnapshot.docs[0];
      const reservationData = reservationDoc.data();

      // Verificar se ainda está dentro do prazo
      const expiresAt = reservationData.expiresAt.toDate ? reservationData.expiresAt.toDate() : reservationData.expiresAt;
      if (expiresAt < new Date()) {
        throw new Error('Reserva expirada');
      }

      // 2. Buscar o histórico de reserva para atualizar
      const historyRef = db
        .collection('reservationHistory')
        .where('email', '==', email)
        .where('eventId', '==', eventId);
      
      const historySnapshot = await transaction.get(historyRef);
      
      if (historySnapshot.empty) {
        throw new Error('Histórico de reserva não encontrado');
      }

      // 3. Buscar estatísticas do evento
      const eventStatsRef = db.collection('eventStats').doc(eventId);
      const eventStatsDoc = await transaction.get(eventStatsRef);
      const currentStats = eventStatsDoc.data() || {};

      // ===== TODAS AS ESCRITAS APÓS TODAS AS LEITURAS =====

      // 4. Atualizar status da reserva para 'paid'
      transaction.update(reservationDoc.ref, {
        status: 'paid',
        paidAt: FieldValue.serverTimestamp()
      });

      // 5. Atualizar o histórico com o charge
      const historyDoc = historySnapshot.docs[0];
      const historyData = historyDoc.data();
      const updatedCharges = historyData?.charges || [];
      updatedCharges.push(charge);

      transaction.update(historyDoc.ref, {
        charges: updatedCharges,
        status: status,
        updatedAt: new Date(),
      });

      // 6. Atualizar estatísticas do evento
      const newStats = { ...currentStats };
      newStats.totalPaid = (newStats.totalPaid || 0) + 1;
      newStats.totalReserved = Math.max(0, (newStats.totalReserved || 0) - 1);

      if (reservationData.gender === 'female') {
        newStats.femalePaid = (newStats.femalePaid || 0) + 1;
        newStats.femaleReserved = Math.max(0, (newStats.femaleReserved || 0) - 1);
      } else {
        newStats.malePaid = (newStats.malePaid || 0) + 1;
        newStats.maleReserved = Math.max(0, (newStats.maleReserved || 0) - 1);
      }

      transaction.set(eventStatsRef, newStats, { merge: true });
    });
  }
}
