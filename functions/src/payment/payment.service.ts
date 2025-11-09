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
      
      // Buscar dados do usuário para verificar gênero
      const userQuery = this.firestoreService.firestore
        .collection('users')
        .where('email', '==', email);
      const userSnapshot = await userQuery.get();
      
      if (userSnapshot.empty) {
        throw new Error('Usuário não encontrado');
      }
      
      const userData = userSnapshot.docs[0].data();
      const userGender = userData.gender as 'male' | 'female';
      
      // ===== VALIDAÇÃO CRÍTICA DE VAGAS =====
      // Forçar verificação de vagas ANTES de processar o pagamento
      console.log(`[PaymentService] 🔍 Verificando disponibilidade de vagas para ${email} (${userGender}) no evento ${eventId}`);
      
      const spotAvailable = await this.checkSpotBeforePayment(eventId, userGender);
      
      if (!spotAvailable.available) {
        console.log(`[PaymentService] ❌ Vagas esgotadas para ${email}. Adicionando à lista de espera.`);
        
        // Adicionar à waiting list
        const waitingListRef = this.firestoreService.firestore
          .collection('waitingList')
          .doc(eventId);
        const waitingListDoc = await waitingListRef.get();
        const existingEmails = waitingListDoc.exists ? waitingListDoc.data()?.emails || [] : [];
        
        if (!existingEmails.includes(email)) {
          await waitingListRef.set({
            emails: [...existingEmails, email],
            updatedAt: new Date(),
          }, { merge: true });
        }
        
        throw new Error('As vagas terminaram. Você foi adicionado à lista de espera e será notificado caso uma vaga seja liberada.');
      }
      
      console.log(`[PaymentService] ✅ Vagas disponíveis confirmadas para ${email}`);
      
      // O preço no banco já está em centavos, não precisa converter
      const VALOR_DO_EVENTO = eventData.price || 36500;
      
      console.log(`[PaymentService] Evento: ${eventId}`);
      console.log(`[PaymentService] Preço do evento: ${VALOR_DO_EVENTO} centavos (R$ ${(VALOR_DO_EVENTO/100).toFixed(2)})`);
      console.log(`[PaymentService] Valor enviado: ${req.items[0].amount} centavos (R$ ${(req.items[0].amount/100).toFixed(2)})`);
      
      // Verificar se existe reserva ativa para esse evento específico
      const reservationStatus = await this.reservationService.getReservationStatus(email, eventId);
      if (reservationStatus.status !== 'reserved' && reservationStatus.status !== 'Pago') {
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


      // VALORRR
      // const itemAmount = bodyPagarme.items[0].amount;
      // Validar que o valor é no mínimo o preço do evento (pode ser maior se tiver juros)
      // if (itemAmount < VALOR_DO_EVENTO) {
      //   throw new Error(`Valor do pagamento não pode ser menor que o ingresso. Mínimo: R$ ${(VALOR_DO_EVENTO/100).toFixed(2)}, Recebido: R$ ${(itemAmount/100).toFixed(2)}`);
      // }

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
    const webhookData = body.data;

    console.log('🎯 Webhook PagarMe recebido:', {
      type: body.type,
      status: webhookData.status,
      email: webhookData.customer?.email,
      chargeId: webhookData.id,
      amount: webhookData.amount,
      paymentMethod: webhookData.payment_method
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
    const email = webhookData.customer.email;
    
    try {
      // CORREÇÃO: Extrair eventId do order/items do webhook
      const eventId = webhookData.order?.items?.[0]?.description || webhookData.items?.[0]?.description;
      
      if (!eventId) {
        throw new Error('EventId não encontrado no webhook. Order: ' + JSON.stringify(webhookData.order));
      }
      
      console.log('🔍 Buscando reserva para:', { email, eventId });
      
      // Buscar a reserva específica para este email E eventId
      const reservationSnapshot = await this.firestoreService.firestore
        .collection('reservationHistory')
        .where('email', '==', email)
        .where('eventId', '==', eventId)
        .limit(1)
        .get();

      if (reservationSnapshot.empty) {
        throw new Error(`Reserva não encontrada para email: ${email} e evento: ${eventId}`);
      }

      const reservationDoc = reservationSnapshot.docs[0];
      const reservationData = reservationDoc.data();

      console.log('📋 Reserva encontrada:', { 
        email, 
        eventId, 
        currentStatus: reservationData.status 
      });

      // Construir o objeto de charge com dados do webhook
      const lastTransaction = webhookData.last_transaction;
      let payLink = '';
      let qrcodePix = '';

      if (webhookData.payment_method === 'pix') {
        payLink = lastTransaction.qr_code || '';
        qrcodePix = lastTransaction.qr_code_url || '';
      } else if (webhookData.payment_method === 'boleto') {
        payLink = lastTransaction.pdf || '';
      } else if (webhookData.payment_method === 'credit_card') {
        payLink = lastTransaction.acquirer_message || '';
      }

      const charge: ChargeDto = {
        event: eventId,
        status: internalStatus,
        amount: webhookData.amount,
        payLink: payLink,
        qrcodePix: qrcodePix,
        meio: webhookData.payment_method,
        email: email,
        lote: 0,
        envioWhatsapp: false,
        chargeId: webhookData.id,
      };

      console.log('💳 Charge criado:', charge);

      // Se for pago, fazer o processo completo
      if (webhookData.status === 'paid') {
        console.log('✅ Pagamento confirmado, iniciando processo...');
        
        await this.confirmPaymentAndUpdateReservation(
          email,
          eventId,
          charge,
          internalStatus
        );

        // Processar fila após confirmação do pagamento
        console.log('🎫 Processando fila do evento...');
        await this.ticketService.processQueue(eventId);
        
        console.log('✅ Pagamento e fila processados com sucesso');
      } else {
        // Para outros status, atualizar tanto o status da reserva quanto do charge
        console.log(`⏳ Status ${internalStatus}, atualizando reserva...`);
        
        await this.updateReservationAndChargeStatus(
          email,
          eventId,
          charge,
          internalStatus
        );
      }

      console.log('✅ Webhook processado com sucesso:', { 
        email, 
        eventId,
        status: internalStatus 
      });

      return { 
        success: true,
        message: 'Webhook processado com sucesso', 
        status: internalStatus 
      };
      
    } catch (error: any) {
      console.error('❌ Erro ao processar webhook:', {
        error: error.message,
        stack: error.stack,
        email: email
      });

      // Retornar erro mas com status 200 para não reenviar o webhook
      return { 
        success: false,
        message: error.message,
        error: error.stack 
      };
    }
  }

  /**
   * Reprocessa/consulta o status de um pagamento diretamente na Pagar.me
   * Se chargeId não for informado, busca pelo último charge no reservationHistory do email+eventId
   */
  async reprocessPaymentStatus(params: { email: string; eventId: string; chargeId?: string }) {
    const { email, eventId } = params;
    let { chargeId } = params;

    const db = this.firestoreService.firestore;
    const pagarmeService = new Pagarme();

    // 1) Descobrir chargeId se não veio
    if (!chargeId) {
      console.log('[Reprocess] 🔎 Buscando reservationHistory para obter chargeId...', { email, eventId });
      const histSnap = await db
        .collection('reservationHistory')
        .where('email', '==', email)
        .where('eventId', '==', eventId)
        .limit(1)
        .get();

      if (histSnap.empty) {
        throw new BadRequestException('Histórico de reserva não encontrado para o email/evento');
      }
      const hDoc = histSnap.docs[0];
      const hData = hDoc.data();
      const charges = hData?.charges || [];
      if (!charges.length) {
        throw new BadRequestException('Nenhum charge encontrado no histórico de reserva');
      }
      // Pegar o último com chargeId válido
      const lastWithId = [...charges].reverse().find((c: any) => !!c.chargeId);
      if (!lastWithId) {
        throw new BadRequestException('Nenhum chargeId válido encontrado');
      }
      chargeId = lastWithId.chargeId;
    }

    console.log('[Reprocess] 🔁 Consultando Pagar.me para charge:', chargeId);
    const chargeResp = await pagarmeService.getCharge(chargeId);

    // 2) Mapear status Pagar.me -> interno
    const statusMapping: Record<string, string> = {
      paid: 'Pago',
      pending: 'Processando',
      processing: 'Processando',
      authorized: 'Processando',
      canceled: 'Cancelado',
      failed: 'Falhou',
      refunded: 'Reembolsado',
      refused: 'Recusado',
    };
    const pagarmeStatus: string = chargeResp?.status || 'unknown';
    const internalStatus = statusMapping[pagarmeStatus] || 'Processando';

    // Extrair campos úteis
    const paymentMethod = chargeResp?.payment_method || 'unknown';
    const amount = chargeResp?.amount ?? 0;
    const lastTx = chargeResp?.last_transaction || {};
    let payLink = '';
    let qrcodePix = '';
    if (paymentMethod === 'pix') {
      payLink = lastTx.qr_code || '';
      qrcodePix = lastTx.qr_code_url || '';
    } else if (paymentMethod === 'boleto') {
      payLink = lastTx.pdf || '';
    } else if (paymentMethod === 'credit_card') {
      payLink = lastTx.acquirer_message || '';
    }

    const chargeDto: ChargeDto = {
      event: eventId,
      status: internalStatus,
      amount,
      payLink,
      qrcodePix,
      meio: paymentMethod,
      email,
      lote: 0,
      envioWhatsapp: false,
      chargeId: chargeId,
    };

    // 3) Atualizar nosso histórico para refletir o status atual (idempotente)
    try {
      if (pagarmeStatus === 'paid') {
        await this.confirmPaymentAndUpdateReservation(email, eventId, chargeDto, internalStatus);
      } else {
        await this.updateReservationAndChargeStatus(email, eventId, chargeDto, internalStatus);
      }
    } catch (e) {
      console.warn('[Reprocess] Aviso: falha ao atualizar histórico local (seguindo com retorno)', e);
    }

    return {
      success: true,
      chargeId,
      pagarmeStatus,
      internalStatus,
      paymentMethod,
      amount,
      updatedAt: new Date().toISOString(),
    };
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
        console.log('🔄 Atualizando charge existente:', charge.chargeId);
      } else {
        // Adicionar novo charge
        updatedCharges.push(charge);
        console.log('➕ Adicionando novo charge:', charge.chargeId);
      }

      // 3. Atualizar AMBOS os status:
      transaction.update(historyDoc.ref, {
        charges: updatedCharges,
        status: status,
        updatedAt: new Date(),
      });

      console.log('✅ Status da reserva E charges atualizados:', { 
        email, 
        eventId, 
        status,
        totalCharges: updatedCharges.length
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
      console.log('� Iniciando transação de confirmação de pagamento...');

      // PREPARO: Definir referências/consultas
      const reservationQuery = db
        .collection('reservations')
        .where('email', '==', email)
        .where('eventId', '==', eventId)
        .where('status', '==', 'reserved');

      const historyQuery = db
        .collection('reservationHistory')
        .where('email', '==', email)
        .where('eventId', '==', eventId);

      const eventStatsRef = db.collection('eventStats').doc(eventId);

      // ETAPA 1: Ler tudo ANTES de qualquer escrita (exigência do Firestore)
      console.log('📥 [TX] Lendo documentos necessários (reservas, histórico, estatísticas)...');
      const [reservationSnapshot, historySnapshot, eventStatsDoc] = await Promise.all([
        transaction.get(reservationQuery),
        transaction.get(historyQuery),
        transaction.get(eventStatsRef),
      ]);

      // Consolidar dados lidos
      const reservationDoc = reservationSnapshot.empty ? null : reservationSnapshot.docs[0];
      const reservationData = reservationDoc ? reservationDoc.data() : null;

      if (!historySnapshot.empty) {
        console.log('📋 [TX] Histórico de reserva encontrado:', {
          count: historySnapshot.size,
        });
      }

      if (historySnapshot.empty) {
        throw new Error('Histórico de reserva não encontrado');
      }

      const historyDoc = historySnapshot.docs[0];
      const historyData = historyDoc.data();

      console.log('🧾 [TX] Estado atual:', {
        hasActiveReservation: !!reservationDoc,
        historyId: historyDoc.id,
        historyStatus: historyData.status,
        historyCharges: historyData.charges?.length || 0,
      });

      // Preparar novos valores (sem escrever ainda)
      let updatedCharges = (historyData?.charges || []).slice();
      const existingChargeIndex = updatedCharges.findIndex(
        (c: any) => c.chargeId === charge.chargeId
      );
      if (existingChargeIndex >= 0) {
        updatedCharges[existingChargeIndex] = charge;
        console.log('🔄 [TX] Charge existente será atualizado:', charge.chargeId);
      } else {
        updatedCharges.push(charge);
        console.log('➕ [TX] Novo charge será adicionado:', charge.chargeId);
      }

      const currentStats = eventStatsDoc.data() || {};
      const newStats: any = { ...currentStats };
      newStats.totalPaid = (newStats.totalPaid || 0) + 1;
      newStats.totalReserved = Math.max(0, (newStats.totalReserved || 0) - 1);

      const gender = historyData.gender;
      if (gender === 'Feminino' || gender === 'female') {
        newStats.femalePaid = (newStats.femalePaid || 0) + 1;
        newStats.femaleReserved = Math.max(0, (newStats.femaleReserved || 0) - 1);
      } else {
        newStats.malePaid = (newStats.malePaid || 0) + 1;
        newStats.maleReserved = Math.max(0, (newStats.maleReserved || 0) - 1);
      }

      console.log('✍️  [TX] Preparando escritas...', {
        willUpdateReservation: !!reservationDoc,
        willUpdateHistoryId: historyDoc.id,
        willSetEventStats: true,
      });

      // ETAPA 2: Executar ESCRITAS (somente após todas as leituras concluídas)
      if (reservationDoc && reservationData) {
        // Checar expiração (apenas log)
        const expiresAt = reservationData.expiresAt?.toDate
          ? reservationData.expiresAt.toDate()
          : reservationData.expiresAt;
        if (expiresAt && expiresAt < new Date()) {
          console.warn('⚠️ Reserva expirada, mas processando pagamento mesmo assim');
        }

        transaction.update(reservationDoc.ref, {
          status: 'Pago',
          paidAt: FieldValue.serverTimestamp(),
        });
        console.log('✅ [TX] Reserva marcada como Pago:', reservationDoc.id);
      } else {
        console.log('ℹ️  [TX] Nenhuma reserva ativa para atualizar');
      }

      transaction.update(historyDoc.ref, {
        charges: updatedCharges,
        status: status,
        updatedAt: new Date(),
      });
      console.log('✅ [TX] Histórico atualizado:', { id: historyDoc.id, status, totalCharges: updatedCharges.length });

      transaction.set(eventStatsRef, newStats, { merge: true });
      console.log('✅ [TX] Estatísticas atualizadas');
    });
  }

  /**
   * Verifica se há vagas disponíveis ANTES de processar o pagamento
   * Considera o tipo de evento (GENERAL ou GENDER_SPECIFIC)
   * Inclui delay de 300ms para sincronização com Firebase
   */
  private async checkSpotBeforePayment(
    eventId: string, 
    userGender: 'male' | 'female'
  ): Promise<{ available: boolean; message?: string }> {
    const db = this.firestoreService.firestore;
    
    // Delay de 300ms para garantir sincronização com Firebase
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      // 1. Buscar configurações do evento
      const eventDoc = await db.collection('events').doc(eventId).get();
      if (!eventDoc.exists) {
        return { available: false, message: 'Evento não encontrado' };
      }
      
      const eventData = eventDoc.data();
      const eventType = eventData?.type || 'general';
      
      // 2. Buscar estatísticas atualizadas
      const statsDoc = await db.collection('eventStats').doc(eventId).get();
      const stats = statsDoc.exists ? statsDoc.data() : {
        totalPaid: 0,
        malePaid: 0,
        femalePaid: 0,
        totalReserved: 0,
        maleReserved: 0,
        femaleReserved: 0,
      };
      
      // 3. Determinar capacidade baseada no tipo de evento
      if (eventType === 'general') {
        // ===== EVENTO GENERAL =====
        const maxSpots = eventData?.maxGeneralSpots || 173;
        const totalOccupied = (stats?.totalPaid || 0) + (stats?.totalReserved || 0);
        
        console.log(`[CheckSpot] GENERAL - Max: ${maxSpots}, Ocupadas: ${totalOccupied}`);
        
        if (totalOccupied >= maxSpots) {
          return { 
            available: false, 
            message: `Evento esgotado (${totalOccupied}/${maxSpots} vagas ocupadas)` 
          };
        }
        
        return { available: true };
        
      } else if (eventType === 'gender_specific') {
        // ===== EVENTO GENDER_SPECIFIC =====
        const maxClientFemale = eventData?.maxClientFemale || 0;
        const maxClientMale = eventData?.maxClientMale || 0;
        
        const maxFemaleSpots = maxClientFemale;
        const maxMaleSpots = maxClientMale;
        const maxTotalSpots = maxFemaleSpots + maxMaleSpots;
        
        // Verificar se o total geral foi excedido (para waiting list)
        const totalPaid = stats?.totalPaid || 0;
        if (totalPaid >= maxTotalSpots) {
          return { 
            available: false, 
            message: `Todas as vagas foram pagas (${totalPaid}/${maxTotalSpots})` 
          };
        }
        
        // Verificar vagas por gênero
        if (userGender === 'female') {
          const femaleOccupied = (stats?.femalePaid || 0) + (stats?.femaleReserved || 0);
          console.log(`[CheckSpot] FEMALE - Max: ${maxFemaleSpots}, Ocupadas: ${femaleOccupied}`);
          
          if (femaleOccupied >= maxFemaleSpots) {
            return { 
              available: false, 
              message: `Vagas femininas esgotadas (${femaleOccupied}/${maxFemaleSpots})` 
            };
          }
        } else {
          const maleOccupied = (stats?.malePaid || 0) + (stats?.maleReserved || 0);
          console.log(`[CheckSpot] MALE - Max: ${maxMaleSpots}, Ocupadas: ${maleOccupied}`);
          
          if (maleOccupied >= maxMaleSpots) {
            return { 
              available: false, 
              message: `Vagas masculinas esgotadas (${maleOccupied}/${maxMaleSpots})` 
            };
          }
        }
        
        return { available: true };
        
      } else {
        // Tipo de evento desconhecido
        console.warn(`[CheckSpot] Tipo de evento desconhecido: ${eventType}`);
        return { available: false, message: 'Tipo de evento inválido' };
      }
      
    } catch (error: any) {
      console.error('[CheckSpot] Erro ao verificar vagas:', error);
      // Em caso de erro, bloquear por segurança
      return { available: false, message: 'Erro ao verificar disponibilidade' };
    }
  }
}
