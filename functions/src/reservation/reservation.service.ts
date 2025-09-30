import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';
import { FieldValue } from 'firebase-admin/firestore';

export interface ReservationData {
  email: string;
  eventId: string;
  gender: 'male' | 'female';
  status: 'pending' | 'reserved' | 'paid' | 'expired';
  createdAt: any; // Firestore Timestamp
  expiresAt: any; // Firestore Timestamp
  position?: number;
}

export interface QueueItem {
  email: string;
  eventId: string;
  gender: 'male' | 'female';
  position: number;
  createdAt: any; // Firestore Timestamp
}

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);
  private readonly RESERVATION_TIMEOUT_MINUTES = 30; // Aumentado para 30 minutos
  private readonly MAX_TOTAL_SPOTS = 173;
  private readonly MAX_FEMALE_SPOTS = 83;
  private readonly MAX_MALE_SPOTS = 90;
  private readonly BATCH_SIZE = 100; // Liberar 100 vagas por vez

  constructor(
    private readonly firestoreService: FirestoreService,
  ) {
    // Iniciar job de limpeza de reservas expiradas a cada 5 minutos
    setInterval(() => {
      this.cleanupExpiredReservations().catch(error => {
        this.logger.error('Erro no job de limpeza de reservas:', error);
      });
    }, 5 * 60 * 1000); // 5 minutos
  }

  /**
   * Tenta reservar uma vaga usando transação do Firestore
   */
  async reserveSpot(email: string, eventId: string, gender: 'male' | 'female'): Promise<{
    status: 'reserved' | 'queued' | 'waiting-list' | 'already-paid';
    message: string;
    position?: number;
    expiresAt?: Date;
  }> {
    const db = this.firestoreService.firestore;
    
    try {
      return await db.runTransaction(async (transaction) => {
        // ===== TODAS AS LEITURAS PRIMEIRO =====
        
        // 1. Verificar se já existe uma reserva ou pagamento para este usuário
        const existingReservationRef = db
          .collection('reservations')
          .where('email', '==', email)
          .where('eventId', '==', eventId)
          .where('status', 'in', ['reserved', 'paid']);
        
        const existingReservationSnapshot = await transaction.get(existingReservationRef);
        
        // 2. Buscar o contador de spots ocupados
        const eventStatsRef = db.collection('eventStats').doc(eventId);
        const eventStatsDoc = await transaction.get(eventStatsRef);
        
        // 3. Se necessário, buscar dados da fila existente
        const existingQueueRef = db
          .collection('queue')
          .where('email', '==', email)
          .where('eventId', '==', eventId);
        
        const existingQueueSnapshot = await transaction.get(existingQueueRef);
        
        // 4. Buscar toda a fila para o gênero (para calcular próxima posição)
        const queueRef = db
          .collection('queue')
          .where('eventId', '==', eventId)
          .where('gender', '==', gender);
        
        const queueSnapshot = await transaction.get(queueRef);
        
        // 5. Buscar lista de espera
        const waitingListRef = db.collection('waitingList').doc(eventId);
        const waitingListDoc = await transaction.get(waitingListRef);
        
        // ===== PROCESSAMENTO (SEM LEITURAS/ESCRITAS DB) =====
        
        // Verificar se já tem reserva/pagamento
        if (!existingReservationSnapshot.empty) {
          const existing = existingReservationSnapshot.docs[0].data() as ReservationData;
          if (existing.status === 'paid') {
            return {
              status: 'already-paid' as const,
              message: 'Você já pagou a sua inscrição.'
            };
          }
          
          // Verificar se a reserva ainda é válida
          const expiresAt = existing.expiresAt.toDate ? existing.expiresAt.toDate() : existing.expiresAt;
          if (expiresAt > new Date()) {
            return {
              status: 'reserved' as const,
              message: 'Você já possui uma reserva ativa.',
              expiresAt: expiresAt
            };
          }
        }
        
        const currentStats = eventStatsDoc.exists ? eventStatsDoc.data() : {
          totalPaid: 0,
          malePaid: 0,
          femalePaid: 0,
          totalReserved: 0,
          maleReserved: 0,
          femaleReserved: 0
        };

        const maxByGender = gender === 'female' ? this.MAX_FEMALE_SPOTS : this.MAX_MALE_SPOTS;
        const currentGenderReserved = gender === 'female' ? currentStats.femaleReserved : currentStats.maleReserved;
        const currentGenderPaid = gender === 'female' ? currentStats.femalePaid : currentStats.malePaid;
        const totalGenderOccupied = currentGenderReserved + currentGenderPaid;

        // Verificar se o total geral excedeu
        if (currentStats.totalPaid >= this.MAX_TOTAL_SPOTS) {
          // ===== ESCRITAS PARA WAITING LIST =====
          const existingEmails = waitingListDoc.exists ? waitingListDoc.data()?.emails || [] : [];
          
          if (!existingEmails.includes(email)) {
            transaction.set(waitingListRef, {
              emails: [...existingEmails, email],
              updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
          }
          
          return {
            status: 'waiting-list' as const,
            message: 'Todos os ingressos foram pagos. Você foi adicionado à lista de interessados.'
          };
        }

        // Verificar se ainda há vagas para o gênero (usando sistema de lotes)
        const maxReservationsAllowed = Math.min(maxByGender, this.BATCH_SIZE);
        
        if (totalGenderOccupied < maxReservationsAllowed) {
          // ===== ESCRITAS PARA RESERVA =====
          
          const expiresAt = new Date(Date.now() + this.RESERVATION_TIMEOUT_MINUTES * 60 * 1000);
          const reservationData: ReservationData = {
            email,
            eventId,
            gender,
            status: 'reserved',
            createdAt: new Date(),
            expiresAt,
            position: totalGenderOccupied + 1
          };

          const reservationRef = db.collection('reservations').doc();
          transaction.set(reservationRef, reservationData);

          // Atualizar estatísticas
          const newStats = { ...currentStats };
          newStats.totalReserved += 1;
          if (gender === 'female') {
            newStats.femaleReserved += 1;
          } else {
            newStats.maleReserved += 1;
          }

          transaction.set(eventStatsRef, newStats, { merge: true });

          return {
            status: 'reserved' as const,
            message: `Reserva efetuada com sucesso. Você tem ${this.RESERVATION_TIMEOUT_MINUTES} minutos para completar o pagamento.`,
            position: reservationData.position,
            expiresAt
          };
        } else {
          // ===== ESCRITAS PARA FILA =====
          
          // Verificar se já está na fila
          const existingItem = existingQueueSnapshot.docs.find(doc => doc.data().gender === gender);
          if (existingItem) {
            return {
              status: 'queued' as const,
              message: 'Aguarde ser chamado.',
              position: existingItem.data().position
            };
          }

          // Calcular próxima posição manualmente
          let maxPosition = 0;
          queueSnapshot.docs.forEach(doc => {
            const position = doc.data().position || 0;
            if (position > maxPosition) {
              maxPosition = position;
            }
          });
          
          const nextPosition = maxPosition + 1;

          const queueItem: QueueItem = {
            email,
            eventId,
            gender,
            position: nextPosition,
            createdAt: new Date()
          };

          const queueDocRef = db.collection('queue').doc();
          transaction.set(queueDocRef, queueItem);

          return {
            status: 'queued' as const,
            message: 'Aguarde ser chamado.',
            position: nextPosition
          };
        }
      });
    } catch (error: any) {
      this.logger.error(`Erro ao reservar vaga: ${error.message}`, error.stack);
      throw new Error('Erro interno ao processar reserva');
    }
  }

  /**
   * Confirma o pagamento e converte reserva em paid
   */
  async confirmPayment(email: string, eventId: string): Promise<void> {
    const db = this.firestoreService.firestore;
    
    await db.runTransaction(async (transaction) => {
      // Buscar reserva ativa
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
      const reservationData = reservationDoc.data() as ReservationData;

      // Verificar se ainda está dentro do prazo
      const expiresAt = reservationData.expiresAt.toDate ? reservationData.expiresAt.toDate() : reservationData.expiresAt;
      if (expiresAt < new Date()) {
        throw new Error('Reserva expirada');
      }

      // Atualizar status para paid
      transaction.update(reservationDoc.ref, {
        status: 'paid',
        paidAt: FieldValue.serverTimestamp()
      });

      // Atualizar estatísticas
      const eventStatsRef = db.collection('eventStats').doc(eventId);
      const eventStatsDoc = await transaction.get(eventStatsRef);
      const currentStats = eventStatsDoc.data() || {};

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

  /**
   * Verifica se uma reserva é válida
   */
  /**
   * Expira uma reserva e libera a vaga
   */
  private async expireReservation(reservationId: string): Promise<void> {
    const db = this.firestoreService.firestore;
    
    await db.runTransaction(async (transaction) => {
      // ===== TODAS AS LEITURAS PRIMEIRO =====
      const reservationRef = db.collection('reservations').doc(reservationId);
      const reservationDoc = await transaction.get(reservationRef);
      
      if (!reservationDoc.exists) {
        return;
      }

      const reservationData = reservationDoc.data() as ReservationData;
      
      // Ler estatísticas também antes das escritas
      const eventStatsRef = db.collection('eventStats').doc(reservationData.eventId);
      const eventStatsDoc = await transaction.get(eventStatsRef);
      
      // ===== PROCESSAMENTO (SEM DB OPERATIONS) =====
      const currentStats = eventStatsDoc.data() || {};
      const newStats = { ...currentStats };
      newStats.totalReserved = Math.max(0, (newStats.totalReserved || 0) - 1);

      if (reservationData.gender === 'female') {
        newStats.femaleReserved = Math.max(0, (newStats.femaleReserved || 0) - 1);
      } else {
        newStats.maleReserved = Math.max(0, (newStats.maleReserved || 0) - 1);
      }

      // ===== TODAS AS ESCRITAS DEPOIS =====
      transaction.update(reservationRef, { status: 'expired' });
      transaction.set(eventStatsRef, newStats, { merge: true });
    });
  }

  /**
   * Processa a fila e promove o próximo da fila para reserva
   */
  async processQueue(eventId: string): Promise<void> {
    try {
      this.logger.log(`Processando fila para evento: ${eventId}`);
      
      const genders: ('male' | 'female')[] = ['male', 'female'];
      
      for (const gender of genders) {
        await this.processGenderQueue(eventId, gender);
      }
      
      this.logger.log(`Processamento de fila concluído para evento: ${eventId}`);
    } catch (error: any) {
      this.logger.error(`Erro ao processar fila do evento ${eventId}: ${error.message}`);
    }
  }

  private async processGenderQueue(eventId: string, gender: 'male' | 'female'): Promise<void> {
    const db = this.firestoreService.firestore;
    
    try {
      await db.runTransaction(async (transaction) => {
        // ===== TODAS AS LEITURAS PRIMEIRO =====
        
        // Verificar estatísticas atuais
        const eventStatsRef = db.collection('eventStats').doc(eventId);
        const eventStatsDoc = await transaction.get(eventStatsRef);
        
        // Buscar pessoas na fila
        const queueRef = db
          .collection('queue')
          .where('eventId', '==', eventId)
          .where('gender', '==', gender);
        
        const queueSnapshot = await transaction.get(queueRef);
        
        // ===== PROCESSAMENTO =====
        
        const currentStats = eventStatsDoc.data() || {};
        const maxByGender = gender === 'female' ? this.MAX_FEMALE_SPOTS : this.MAX_MALE_SPOTS;
        const maxReservationsAllowed = Math.min(maxByGender, this.BATCH_SIZE);
        
        const currentGenderReserved = gender === 'female' ? (currentStats.femaleReserved || 0) : (currentStats.maleReserved || 0);
        const currentGenderPaid = gender === 'female' ? (currentStats.femalePaid || 0) : (currentStats.malePaid || 0);
        const totalGenderOccupied = currentGenderReserved + currentGenderPaid;
        
        // Calcular quantas vagas podem ser liberadas
        const availableSlots = maxReservationsAllowed - totalGenderOccupied;
        
        if (availableSlots <= 0 || queueSnapshot.empty) {
          return;
        }
        
        // Ordenar fila por posição e pegar apenas as vagas disponíveis
        const queueItems = queueSnapshot.docs
          .map(doc => ({ doc, data: doc.data() as QueueItem }))
          .sort((a, b) => a.data.position - b.data.position)
          .slice(0, availableSlots);
        
        if (queueItems.length === 0) {
          return;
        }
        
        this.logger.log(`Promovendo ${queueItems.length} pessoas da fila para reserva (${gender}) no evento ${eventId}`);
        
        // ===== TODAS AS ESCRITAS DEPOIS =====
        
        let newStats = { ...currentStats };
        
        for (let i = 0; i < queueItems.length; i++) {
          const { doc, data } = queueItems[i];
          
          // Remover da fila
          transaction.delete(doc.ref);
          
          // Criar nova reserva
          const expiresAt = new Date(Date.now() + this.RESERVATION_TIMEOUT_MINUTES * 60 * 1000);
          const reservationData: ReservationData = {
            email: data.email,
            eventId: data.eventId,
            gender: data.gender,
            status: 'reserved',
            createdAt: new Date(),
            expiresAt,
            position: totalGenderOccupied + i + 1
          };
          
          const reservationRef = db.collection('reservations').doc();
          transaction.set(reservationRef, reservationData);
          
          // Atualizar estatísticas
          newStats.totalReserved = (newStats.totalReserved || 0) + 1;
          if (gender === 'female') {
            newStats.femaleReserved = (newStats.femaleReserved || 0) + 1;
          } else {
            newStats.maleReserved = (newStats.maleReserved || 0) + 1;
          }
        }
        
        // Salvar estatísticas atualizadas
        transaction.set(eventStatsRef, newStats, { merge: true });
        
        this.logger.log(`Processamento concluído: ${queueItems.length} pessoas promovidas para reserva`);
      });
      
    } catch (error: any) {
      this.logger.error(`Erro ao processar fila do gênero ${gender}: ${error.message}`, error.stack);
    }
  }

  /**
   * Obtém o status da reserva de um usuário
   */
  async getReservationStatus(email: string, eventId: string): Promise<{
    status: 'reserved' | 'expired' | 'queued' | 'waiting-list' | 'paid' | 'none';
    expiresAt?: Date;
    position?: number;
    remainingMinutes?: number;
  }> {
    const db = this.firestoreService.firestore;
    
    // Verificar reservas ativas
    const reservationRef = db
      .collection('reservations')
      .where('email', '==', email)
      .where('eventId', '==', eventId)
      .where('status', 'in', ['reserved', 'paid']);
    
    const reservationSnapshot = await reservationRef.get();
    
    if (!reservationSnapshot.empty) {
      const reservation = reservationSnapshot.docs[0].data() as ReservationData;
      
      if (reservation.status === 'paid') {
        return { status: 'paid' };
      }
      
      const now = new Date();
      const expiresAt = reservation.expiresAt.toDate ? reservation.expiresAt.toDate() : reservation.expiresAt;
      
      if (expiresAt > now) {
        const remainingMinutes = Math.ceil((expiresAt.getTime() - now.getTime()) / 60000);
        return {
          status: 'reserved',
          expiresAt,
          position: reservation.position,
          remainingMinutes
        };
      } else {
        // Expirar a reserva
        await this.expireReservation(reservationSnapshot.docs[0].id);
        return { status: 'expired' };
      }
    }

    // Verificar se está na fila
    const queueRef = db
      .collection('queue')
      .where('email', '==', email)
      .where('eventId', '==', eventId);
    
    const queueSnapshot = await queueRef.get();
    
    if (!queueSnapshot.empty) {
      const queueData = queueSnapshot.docs[0].data() as QueueItem;
      return {
        status: 'queued',
        position: queueData.position
      };
    }

    // Verificar se está na lista de espera
    const waitingListRef = db.collection('waitingList').doc(eventId);
    const waitingListDoc = await waitingListRef.get();
    
    if (waitingListDoc.exists) {
      const emails = waitingListDoc.data()?.emails || [];
      if (emails.includes(email)) {
        return { status: 'waiting-list' };
      }
    }

    return { status: 'none' };
  }

  /**
   * Job para limpar reservas expiradas e liberar vagas
   */
  private async cleanupExpiredReservations(): Promise<void> {
    try {
      this.logger.log('Iniciando limpeza de reservas expiradas...');
      
      const db = this.firestoreService.firestore;
      const now = new Date();
      
      // Buscar todas as reservas com status 'reserved' primeiro
      const reservedReservationsRef = db
        .collection('reservations')
        .where('status', '==', 'reserved');
      
      const reservedSnapshot = await reservedReservationsRef.get();
      
      if (reservedSnapshot.empty) {
        this.logger.log('Nenhuma reserva encontrada.');
        return;
      }
      
      // Filtrar as expiradas em memória para evitar índice composto
      const expiredDocs = reservedSnapshot.docs.filter(doc => {
        const data = doc.data() as ReservationData;
        const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : data.expiresAt;
        return expiresAt < now;
      });
      
      if (expiredDocs.length === 0) {
        this.logger.log('Nenhuma reserva expirada encontrada.');
        return;
      }
      
      this.logger.log(`Encontradas ${expiredDocs.length} reservas expiradas.`);
      
      // Processar em lotes para evitar problemas de performance
      const batches = [];
      let batch = db.batch();
      let operationCount = 0;
      
      const eventStats = new Map<string, any>();
      
      for (const doc of expiredDocs) {
        const reservationData = doc.data() as ReservationData;
        
        // Marcar como expirada
        batch.update(doc.ref, { status: 'expired', expiredAt: now });
        
        // Acumular estatísticas por evento
        if (!eventStats.has(reservationData.eventId)) {
          eventStats.set(reservationData.eventId, {
            totalReserved: 0,
            maleReserved: 0,
            femaleReserved: 0
          });
        }
        
        const stats = eventStats.get(reservationData.eventId);
        stats.totalReserved += 1;
        if (reservationData.gender === 'female') {
          stats.femaleReserved += 1;
        } else {
          stats.maleReserved += 1;
        }
        
        operationCount++;
        
        // Firestore batch limit é 500 operações
        if (operationCount >= 400) {
          batches.push(batch);
          batch = db.batch();
          operationCount = 0;
        }
      }
      
      // Atualizar estatísticas dos eventos
      for (const [eventId, stats] of eventStats) {
        const eventStatsRef = db.collection('eventStats').doc(eventId);
        
        batch.update(eventStatsRef, {
          totalReserved: FieldValue.increment(-stats.totalReserved),
          maleReserved: FieldValue.increment(-stats.maleReserved),
          femaleReserved: FieldValue.increment(-stats.femaleReserved)
        });
        
        operationCount++;
        
        if (operationCount >= 400) {
          batches.push(batch);
          batch = db.batch();
          operationCount = 0;
        }
      }
      
      if (operationCount > 0) {
        batches.push(batch);
      }
      
      // Executar todos os batches
      await Promise.all(batches.map(b => b.commit()));
      
      this.logger.log(`Limpeza concluída. ${expiredDocs.length} reservas expiradas.`);
      
      // Processar filas dos eventos afetados para promover pessoas
      for (const eventId of eventStats.keys()) {
        await this.processQueue(eventId);
      }
      
    } catch (error: any) {
      this.logger.error(`Erro na limpeza de reservas expiradas: ${error.message}`, error.stack);
    }
  }

  /**
   * Libera novos lotes de vagas baseado na demanda
   */
  async releaseNewBatch(eventId: string): Promise<void> {
    try {
      const db = this.firestoreService.firestore;
      
      // Verificar quantas pessoas estão na fila
      const queueRef = db.collection('queue').where('eventId', '==', eventId);
      const queueSnapshot = await queueRef.get();
      
      if (queueSnapshot.size >= this.BATCH_SIZE) {
        this.logger.log(`Liberando novo lote de ${this.BATCH_SIZE} vagas para evento ${eventId}`);
        
        // Processar fila para promover pessoas
        await this.processQueue(eventId);
      }
    } catch (error: any) {
      this.logger.error(`Erro ao liberar novo lote: ${error.message}`, error.stack);
    }
  }

  /**
   * Busca reservas ativas do usuário
   */
  async getUserActiveReservations(email: string): Promise<ReservationData[]> {
    const db = this.firestoreService.firestore;
    
    const reservationRef = db
      .collection('reservations')
      .where('email', '==', email)
      .where('status', 'in', ['reserved', 'paid']);
    
    const snapshot = await reservationRef.get();
    
    if (snapshot.empty) {
      return [];
    }

    // Ordenar no código ao invés de usar orderBy (para evitar índice)
    const reservations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any));
    
    // Ordenar por createdAt em memória
    reservations.sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : a.createdAt?.getTime() || 0;
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : b.createdAt?.getTime() || 0;
      return bTime - aTime; // Mais recente primeiro
    });

    return reservations;
  }
}
