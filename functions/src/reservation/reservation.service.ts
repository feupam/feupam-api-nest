import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';
import { FieldValue } from 'firebase-admin/firestore';

export interface ReservationData {
  email: string;
  eventId: string;
  gender: 'male' | 'female';
  status: 'pending' | 'reserved' | 'Pago';
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

export interface EventSettings {
  maxClientFemale: number;
  maxClientMale: number;
  maxGeneralSpots: number;
  maxStaffFemale: number;
  maxStaffMale: number;
}

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);
  
  // Tempo fixo de reserva: 5 minutos
  private readonly RESERVATION_TIMEOUT_MINUTES = 5;
  
  // Cache em memória para estatísticas
  private eventStatsCache = new Map<string, {
    data: any;
    timestamp: number;
    ttl: number; // TTL em milissegundos
  }>();
  
  // Cache em memória para configurações de evento
  private eventSettingsCache = new Map<string, {
    data: EventSettings;
    timestamp: number;
    ttl: number;
  }>();
  
  // TTL padrão de 30 segundos para cache
  private readonly DEFAULT_CACHE_TTL = 30 * 1000;
  
  // Controle de jobs dinâmicos
  private cleanupJobInterval: NodeJS.Timeout | null = null;
  private cacheCleanupInterval: NodeJS.Timeout | null = null;
  private isJobsActive = false;
  private lastActivityCheck = Date.now();
  
  // Intervalo para verificar atividade (a cada 2 minutos)
  private readonly ACTIVITY_CHECK_INTERVAL = 2 * 60 * 1000;
  // Se não houver atividade por 10 minutos, desligar jobs
  private readonly INACTIVITY_THRESHOLD = 10 * 60 * 1000;

  constructor(
    private readonly firestoreService: FirestoreService,
  ) {
    // Inicializar sistema de jobs dinâmicos
    this.initializeDynamicJobs();
    
    // Monitorar atividade periodicamente
    setInterval(() => {
      this.checkActivityAndManageJobs();
    }, this.ACTIVITY_CHECK_INTERVAL);
  }

  /**
   * Inicializa o sistema de jobs dinâmicos
   */
  private async initializeDynamicJobs(): Promise<void> {
    try {
      // Verificar se há reservas ativas no sistema
      const hasActiveReservations = await this.checkForActiveReservations();
      
      if (hasActiveReservations) {
        this.startJobs();
        this.logger.log('🔄 Jobs iniciados - reservas ativas encontradas');
      } else {
        this.logger.log('🚦 Sistema iniciado sem jobs - nenhuma reserva ativa');
      }
    } catch (error: any) {
      this.logger.error('Erro ao inicializar jobs dinâmicos:', error);
      // Em caso de erro, iniciar jobs por segurança
      this.startJobs();
    }
  }
  
  /**
   * Verifica se existem reservas ativas no sistema
   */
  private async checkForActiveReservations(): Promise<boolean> {
    try {
      const db = this.firestoreService.firestore;
      
      // Verificar reservas com status 'reserved'
      const reservationsSnapshot = await db
        .collection('reservations')
        .where('status', '==', 'reserved')
        .limit(1)
        .get();
      
      return !reservationsSnapshot.empty;
    } catch (error: any) {
      this.logger.error('Erro ao verificar reservas ativas:', error);
      return true; // Em caso de erro, assumir que há atividade
    }
  }
  
  /**
   * Inicia os jobs de limpeza
   */
  private startJobs(): void {
    if (this.isJobsActive) {
      return; // Jobs já estão ativos
    }
    
    this.isJobsActive = true;
    this.lastActivityCheck = Date.now();
    
    // Job de limpeza de reservas expiradas a cada 2 minutos
    this.cleanupJobInterval = setInterval(() => {
      this.cleanupExpiredReservations().catch(error => {
        this.logger.error('Erro no job de limpeza de reservas:', error);
      });
    }, 2 * 60 * 1000);
    
    // Limpeza automática do cache a cada 10 minutos
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupExpiredCache();
    }, 10 * 60 * 1000);
    
    this.logger.log('✅ Jobs de limpeza LIGADOS');
  }
  
  /**
   * Para os jobs de limpeza
   */
  private stopJobs(): void {
    if (!this.isJobsActive) {
      return; // Jobs já estão inativos
    }
    
    this.isJobsActive = false;
    
    if (this.cleanupJobInterval) {
      clearInterval(this.cleanupJobInterval);
      this.cleanupJobInterval = null;
    }
    
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    
    this.logger.log('❌ Jobs de limpeza DESLIGADOS');
  }
  
  /**
   * Verifica atividade e gerencia jobs automaticamente
   */
  private async checkActivityAndManageJobs(): Promise<void> {
    try {
      const hasActiveReservations = await this.checkForActiveReservations();
      
      if (hasActiveReservations) {
        // Há atividade - garantir que jobs estejam ligados
        this.lastActivityCheck = Date.now();
        if (!this.isJobsActive) {
          this.startJobs();
          this.logger.log('🔄 Jobs religados - atividade detectada');
        }
      } else {
        // Sem atividade - verificar se jobs estão ativos
        if (this.isJobsActive) {
          // Jobs estão ativos, mas não há reservas - verificar se deve desligar
          const inactiveTime = Date.now() - this.lastActivityCheck;
          
          if (inactiveTime >= this.INACTIVITY_THRESHOLD) {
            this.stopJobs();
            this.logger.log('💤 Jobs desligados - sem atividade por mais de 10 minutos');
          } else {
            // Só mostrar contagem regressiva se jobs estiverem ativos E dentro do prazo
            const remainingTime = this.INACTIVITY_THRESHOLD - inactiveTime;
            const remainingMinutes = Math.ceil(remainingTime / 60000);
            
            if (remainingMinutes > 0) {
              this.logger.log(`💤 Sem reservas ativas. Desligando jobs em ${remainingMinutes} minutos...`);
            }
          }
        }
        // Se jobs não estão ativos E não há reservas, não fazer nada (não logar)
      }
    } catch (error: any) {
      this.logger.error('Erro ao verificar atividade:', error);
    }
  }
  
  /**
   * Força a ativação dos jobs (chamado quando há nova atividade)
   */
  private ensureJobsActive(): void {
    this.lastActivityCheck = Date.now();
    if (!this.isJobsActive) {
      this.startJobs();
      this.logger.log('🚀 Jobs ativados por nova atividade');
    }
  }

  /**
   * Métodos de cache para otimizar consultas
   */
  private isValidCache(cacheEntry: any): boolean {
    if (!cacheEntry) return false;
    const now = Date.now();
    return (now - cacheEntry.timestamp) < cacheEntry.ttl;
  }
  
  private setCache<T>(cache: Map<string, any>, key: string, data: T, ttl: number = this.DEFAULT_CACHE_TTL): void {
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  private getCache<T>(cache: Map<string, any>, key: string): T | null {
    const cacheEntry = cache.get(key);
    if (this.isValidCache(cacheEntry)) {
      return cacheEntry.data;
    }
    // Cache expirado, remover
    cache.delete(key);
    return null;
  }
  
  private invalidateCache(eventId: string): void {
    // Invalidar cache de stats e settings para o evento
    this.eventStatsCache.delete(eventId);
    this.eventSettingsCache.delete(eventId);
  }
  
  /**
   * Limpeza automática do cache expirado
   */
  private cleanupExpiredCache(): void {
    // Limpar cache de stats expirado
    for (const [key, cacheEntry] of this.eventStatsCache.entries()) {
      if (!this.isValidCache(cacheEntry)) {
        this.eventStatsCache.delete(key);
      }
    }
    
    // Limpar cache de settings expirado
    for (const [key, cacheEntry] of this.eventSettingsCache.entries()) {
      if (!this.isValidCache(cacheEntry)) {
        this.eventSettingsCache.delete(key);
      }
    }
    
    this.logger.debug('Cache limpo automaticamente');
  }

  /**
   * Busca as configurações do evento no Firestore - OBRIGATÓRIO existir no banco
   */
  private async getEventSettings(eventId: string): Promise<EventSettings> {
    // Tentar buscar do cache primeiro
    const cached = this.getCache<EventSettings>(this.eventSettingsCache, eventId);
    if (cached) {
      return cached;
    }
    
    try {
      const db = this.firestoreService.firestore;
      const eventRef = db.collection('events').doc(eventId);
      const eventDoc = await eventRef.get();
      
      if (!eventDoc.exists) {
        throw new Error(`Evento ${eventId} não encontrado no banco de dados.`);
      }
      
      const eventData = eventDoc.data();
      
      if (!eventData) {
        throw new Error(`Dados do evento ${eventId} estão vazios no banco de dados.`);
      }
      
      // Buscar os campos diretamente do documento do evento
      // Todos os campos são obrigatórios
      const maxClientFemale = parseInt(eventData.maxClientFemale || '0');
      const maxClientMale = parseInt(eventData.maxClientMale || '0');
      const maxGeneralSpots = parseInt(eventData.maxGeneralSpots || '0');
      const maxStaffFemale = parseInt(eventData.maxStaffFemale || '0');
      const maxStaffMale = parseInt(eventData.maxStaffMale || '0');
      
      // Validar se os campos existem e são válidos
      if (isNaN(maxClientFemale) || isNaN(maxClientMale) || isNaN(maxGeneralSpots) || 
          isNaN(maxStaffFemale) || isNaN(maxStaffMale)) {
        throw new Error(`Configurações inválidas para evento ${eventId}. Verifique os campos no banco de dados.`);
      }
      
      const settings = {
        maxClientFemale,
        maxClientMale,
        maxGeneralSpots,
        maxStaffFemale,
        maxStaffMale
      };
      
      // Cachear por mais tempo (5 minutos) pois configurações mudam raramente
      this.setCache(this.eventSettingsCache, eventId, settings, 5 * 60 * 1000);
      
      return settings;
    } catch (error: any) {
      this.logger.error(`Erro ao buscar configurações do evento ${eventId}: ${error.message}`);
      throw error; // Re-lançar o erro ao invés de usar padrões
    }
  }

  /**
   * Calcula o tempo de expiração - sempre 5 minutos
   */
  private calculateExpirationTime(): Date {
    return new Date(Date.now() + this.RESERVATION_TIMEOUT_MINUTES * 60 * 1000);
  }

  /**
   * Cria ou atualiza as configurações de um evento
   */
  async updateEventSettings(eventId: string, settings: Partial<EventSettings>): Promise<void> {
    try {
      const db = this.firestoreService.firestore;
      const eventRef = db.collection('events').doc(eventId);
      
      // Buscar configurações existentes primeiro
      const existingDoc = await eventRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() : {};
      
      // Mesclar com as novas configurações
      await eventRef.set({
        ...existingData,
        ...settings,
        updatedAt: new Date()
      }, { merge: true });
      
      this.logger.log(`Configurações atualizadas para evento ${eventId}`);
      
      // Invalidar cache após atualizar configurações
      this.invalidateCache(eventId);
    } catch (error: any) {
      this.logger.error(`Erro ao atualizar configurações do evento ${eventId}: ${error.message}`);
      throw error;
    }
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
    
    // Ativar jobs ao processar nova reserva
    this.ensureJobsActive();
    
    // Buscar configurações do evento
    const settings = await this.getEventSettings(eventId);
    
    try {
      return await db.runTransaction(async (transaction) => {
        // ===== TODAS AS LEITURAS PRIMEIRO =====
        
        // 1. Verificar se já existe uma reserva ou pagamento para este usuário
        const existingReservationRef = db
          .collection('reservations')
          .where('email', '==', email)
          .where('eventId', '==', eventId)
          .where('status', 'in', ['reserved', 'Pago']);
        
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
          if (existing.status === 'Pago') {
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

        // Verificar tipo de evento: geral ou por gênero
        const isGeneralEvent = settings.maxGeneralSpots > 0;
        const isGenderEvent = settings.maxClientFemale > 0 || settings.maxClientMale > 0 || 
                             settings.maxStaffFemale > 0 || settings.maxStaffMale > 0;

        // DEBUG: Logs para verificar tipo de evento e capacidade
        this.logger.log(`[DEBUG] Settings: ${JSON.stringify(settings)}`);
        this.logger.log(`[DEBUG] CurrentStats: ${JSON.stringify(currentStats)}`);
        this.logger.log(`[DEBUG] EventType: isGeneral=${isGeneralEvent}, isGender=${isGenderEvent}`);

        let maxTotalSpots: number;
        let hasAvailableSpot: boolean;

        if (isGeneralEvent && !isGenderEvent) {
          // Evento GERAL - não importa o gênero, usa maxGeneralSpots
          maxTotalSpots = settings.maxGeneralSpots;
          const totalOccupied = (currentStats.totalReserved || 0) + (currentStats.totalPaid || 0);
          hasAvailableSpot = totalOccupied < maxTotalSpots;
          
          this.logger.log(`[DEBUG] EVENTO GERAL: maxSpots=${maxTotalSpots}, occupied=${totalOccupied}, available=${hasAvailableSpot}`);
        } else if (isGenderEvent && !isGeneralEvent) {
          // Evento POR GÊNERO - verificar capacidade por gênero
          const maxByGender = gender === 'female' 
            ? settings.maxClientFemale + settings.maxStaffFemale 
            : settings.maxClientMale + settings.maxStaffMale;
          const currentGenderReserved = gender === 'female' ? (currentStats.femaleReserved || 0) : (currentStats.maleReserved || 0);
          const currentGenderPaid = gender === 'female' ? (currentStats.femalePaid || 0) : (currentStats.malePaid || 0);
          const totalGenderOccupied = currentGenderReserved + currentGenderPaid;
          
          maxTotalSpots = settings.maxClientFemale + settings.maxClientMale + settings.maxStaffFemale + settings.maxStaffMale;
          hasAvailableSpot = totalGenderOccupied < maxByGender;
          
          this.logger.log(`[DEBUG] EVENTO POR GÊNERO: gender=${gender}, maxByGender=${maxByGender}, occupied=${totalGenderOccupied}, available=${hasAvailableSpot}`);
        } else {
          // Configuração inválida
          throw new Error(`Configuração inválida para evento ${eventId}: deve ter OU maxGeneralSpots > 0 OU campos por gênero > 0, não ambos ou nenhum.`);
        }

        // Verificar se o total geral excedeu (para waiting list)
        if (currentStats.totalPaid >= maxTotalSpots) {
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

        // Verificar se ainda há vagas disponíveis
        if (hasAvailableSpot) {
          // ===== ESCRITAS PARA RESERVA =====
          
          const expiresAt = this.calculateExpirationTime();
          
          // Calcular posição baseada no tipo de evento
          let position: number;
          if (isGeneralEvent) {
            // Evento geral: posição baseada no total
            position = (currentStats.totalReserved || 0) + (currentStats.totalPaid || 0) + 1;
          } else {
            // Evento por gênero: posição baseada no gênero
            const currentGenderReserved = gender === 'female' ? (currentStats.femaleReserved || 0) : (currentStats.maleReserved || 0);
            const currentGenderPaid = gender === 'female' ? (currentStats.femalePaid || 0) : (currentStats.malePaid || 0);
            position = currentGenderReserved + currentGenderPaid + 1;
          }
          
          const reservationData: ReservationData = {
            email,
            eventId,
            gender,
            status: 'reserved',
            createdAt: new Date(),
            expiresAt,
            position
          };

          const reservationRef = db.collection('reservations').doc();
          transaction.set(reservationRef, reservationData);

          // Atualizar estatísticas
          const newStats = { ...currentStats };
          newStats.totalReserved = (newStats.totalReserved || 0) + 1;
          if (gender === 'female') {
            newStats.femaleReserved = (newStats.femaleReserved || 0) + 1;
          } else {
            newStats.maleReserved = (newStats.maleReserved || 0) + 1;
          }

          transaction.set(eventStatsRef, newStats, { merge: true });

          // Invalidar cache após criar reserva
          this.invalidateCache(eventId);

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
   * Confirma o pagamento e converte reserva em Pago
   */
  async confirmPayment(email: string, eventId: string): Promise<void> {
    const db = this.firestoreService.firestore;
    
    // Ativar jobs ao processar pagamento
    this.ensureJobsActive();
    
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

      // Atualizar status para Pago
      transaction.update(reservationDoc.ref, {
        status: 'Pago',
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
    
    // Invalidar cache após confirmar pagamento
    this.invalidateCache(eventId);
  }

  /**
   * Verifica se uma reserva é válida
   */

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
    
    // Buscar configurações do evento
    const settings = await this.getEventSettings(eventId);
    
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
        
        // Verificar tipo de evento
        const isGeneralEvent = settings.maxGeneralSpots > 0;
        const isGenderEvent = settings.maxClientFemale > 0 || settings.maxClientMale > 0 || 
                             settings.maxStaffFemale > 0 || settings.maxStaffMale > 0;
        
        let maxReservationsAllowed: number;
        let currentOccupied: number;
        
        if (isGeneralEvent && !isGenderEvent) {
          // Evento geral: não importa o gênero, usar capacidade total
          maxReservationsAllowed = settings.maxGeneralSpots;
          currentOccupied = (currentStats.totalReserved || 0) + (currentStats.totalPaid || 0);
        } else if (isGenderEvent && !isGeneralEvent) {
          // Evento por gênero: usar capacidade específica do gênero
          maxReservationsAllowed = gender === 'female' 
            ? settings.maxClientFemale + settings.maxStaffFemale 
            : settings.maxClientMale + settings.maxStaffMale;
          const currentGenderReserved = gender === 'female' ? (currentStats.femaleReserved || 0) : (currentStats.maleReserved || 0);
          const currentGenderPaid = gender === 'female' ? (currentStats.femalePaid || 0) : (currentStats.malePaid || 0);
          currentOccupied = currentGenderReserved + currentGenderPaid;
        } else {
          this.logger.error(`Configuração inválida para evento ${eventId} no processamento da fila`);
          return;
        }
        
        // Calcular quantas vagas podem ser liberadas
        const availableSlots = maxReservationsAllowed - currentOccupied;
        
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
          const expiresAt = this.calculateExpirationTime();
          
          // Calcular posição baseada no tipo de evento
          let position: number;
          if (isGeneralEvent) {
            position = currentOccupied + i + 1;
          } else {
            position = currentOccupied + i + 1;
          }
          
          const reservationData: ReservationData = {
            email: data.email,
            eventId: data.eventId,
            gender: data.gender,
            status: 'reserved',
            createdAt: new Date(),
            expiresAt,
            position
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
   * Obtém o status da reserva de um usuário (com otimização)
   */
  async getReservationStatus(email: string, eventId: string): Promise<{
    status: 'reserved' | 'queued' | 'waiting-list' | 'Pago' | 'none';
    expiresAt?: Date;
    position?: number;
    remainingMinutes?: number;
  }> {
    const db = this.firestoreService.firestore;
    
    try {
      // Fazer uma única query combinada para reservas
      const reservationRef = db
        .collection('reservations')
        .where('email', '==', email)
        .where('eventId', '==', eventId)
        .where('status', 'in', ['reserved', 'Pago']);
      
      const reservationSnapshot = await reservationRef.get();
      
      if (!reservationSnapshot.empty) {
        const reservation = reservationSnapshot.docs[0].data() as ReservationData;
        
        // Se encontrou reserva, garantir que jobs estejam ativos
        if (reservation.status === 'reserved') {
          this.ensureJobsActive();
        }
        
        if (reservation.status === 'Pago') {
          return { status: 'Pago' };
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
          // Reserva expirada - será limpa pelo job automático
          this.logger.log(`Reserva expirada encontrada para ${email} - será limpa pelo job automático`);
          return { status: 'none' };
        }
      }

      // Verificar fila e waiting list em paralelo para otimizar
      const [queueSnapshot, waitingListDoc] = await Promise.all([
        db.collection('queue')
          .where('email', '==', email)
          .where('eventId', '==', eventId)
          .get(),
        db.collection('waitingList').doc(eventId).get()
      ]);
      
      // Verificar se está na fila
      if (!queueSnapshot.empty) {
        const queueData = queueSnapshot.docs[0].data() as QueueItem;
        return {
          status: 'queued',
          position: queueData.position
        };
      }

      // Verificar se está na lista de espera
      if (waitingListDoc.exists) {
        const emails = waitingListDoc.data()?.emails || [];
        if (emails.includes(email)) {
          return { status: 'waiting-list' };
        }
      }

      return { status: 'none' };
    } catch (error: any) {
      this.logger.error(`Erro ao verificar status da reserva: ${error.message}`);
      // Em caso de erro, retornar status 'none' para não quebrar o fluxo
      return { status: 'none' };
    }
  }

  /**
   * Limpeza de dados antigos com status 'expired' (não deveria existir)
   */
  async cleanupLegacyExpiredData(): Promise<void> {
    try {
      this.logger.log('Verificando dados antigos com status "expired"...');
      
      const db = this.firestoreService.firestore;
      
      // Buscar qualquer reserva com status 'expired' (dados antigos)
      const expiredReservationsRef = db
        .collection('reservations')
        .where('status', '==', 'expired');
      
      const expiredSnapshot = await expiredReservationsRef.get();
      
      if (expiredSnapshot.empty) {
        this.logger.log('Nenhum dado antigo com status "expired" encontrado.');
        return;
      }
      
      this.logger.log(`Encontrados ${expiredSnapshot.size} registros antigos com status "expired". DELETANDO...`);
      
      // Deletar em lotes
      const batches = [];
      let batch = db.batch();
      let operationCount = 0;
      
      const eventStats = new Map<string, any>();
      
      for (const doc of expiredSnapshot.docs) {
        const reservationData = doc.data() as ReservationData;
        
        // DELETAR o documento
        batch.delete(doc.ref);
        
        // Acumular estatísticas por evento para ajustar
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
        
        if (operationCount >= 400) {
          batches.push(batch);
          batch = db.batch();
          operationCount = 0;
        }
      }
      
      // Ajustar estatísticas (assumindo que eram contadas como reservadas)
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
      
      this.logger.log(`🗑️ Limpeza de dados antigos concluída. ${expiredSnapshot.size} registros "expired" foram DELETADOS.`);
      
      // Invalidar cache dos eventos afetados
      for (const eventId of eventStats.keys()) {
        this.invalidateCache(eventId);
      }
      
    } catch (error: any) {
      this.logger.error(`Erro na limpeza de dados antigos: ${error.message}`, error.stack);
    }
  }

  /**
   * Força a execução da limpeza de reservas expiradas (removido - usar apenas job automático)
   */

  /**
   * Job para limpar reservas expiradas e liberar vagas
   */
  private async cleanupExpiredReservations(): Promise<void> {
    try {
      this.logger.log('🧹 [CLEANUP] Iniciando limpeza de reservas expiradas...');
      
      const db = this.firestoreService.firestore;
      const now = new Date();
      
      // Buscar apenas reservas com status 'reserved' (não existe mais 'expired')
      const reservedReservationsRef = db
        .collection('reservations')
        .where('status', '==', 'reserved');
      
      const reservedSnapshot = await reservedReservationsRef.get();
      
      this.logger.log(`🧹 [CLEANUP] Encontradas ${reservedSnapshot.size} reservas com status 'reserved'`);
      
      if (reservedSnapshot.empty) {
        this.logger.log('🧹 [CLEANUP] Nenhuma reserva encontrada para verificar.');
        return;
      }
      
      // Filtrar as expiradas em memória para evitar índice composto
      const expiredDocsPromises = reservedSnapshot.docs.map(async (doc) => {
        const data = doc.data() as ReservationData;
        const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : data.expiresAt;
        const createdAt = data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt;
        
        // Verificar se já passou do tempo de expiração
        const isExpired = expiresAt < now;
        
        // Garantir que a reserva tenha pelo menos 5 minutos de vida (tempo mínimo)
        const minExpirationTime = new Date(createdAt.getTime() + this.RESERVATION_TIMEOUT_MINUTES * 60 * 1000);
        const hasMinimumTime = now >= minExpirationTime;
        
        // Só considerar expirada se passou do tempo E já teve o tempo mínimo
        return (isExpired && hasMinimumTime) ? doc : null;
      });
      
      const expiredDocsResults = await Promise.all(expiredDocsPromises);
      const expiredDocs = expiredDocsResults.filter(doc => doc !== null);
      
      if (expiredDocs.length === 0) {
        this.logger.log('🧹 [CLEANUP] Nenhuma reserva expirada encontrada após verificar tempo.');
        return;
      }
      
      this.logger.log(`🧹 [CLEANUP] Encontradas ${expiredDocs.length} reservas expiradas para deletar.`);
      
      // Processar em lotes para evitar problemas de performance
      const batches = [];
      let batch = db.batch();
      let operationCount = 0;
      
      const eventStats = new Map<string, any>();
      
      for (const doc of expiredDocs) {
        const reservationData = doc.data() as ReservationData;
        
        // APAGAR a reserva ao invés de marcar como expirada
        batch.delete(doc.ref);
        
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
      
      this.logger.log(`Limpeza concluída. ${expiredDocs.length} reservas expiradas foram APAGADAS do banco.`);
      
      // Processar filas dos eventos afetados para promover pessoas
      for (const eventId of eventStats.keys()) {
        await this.processQueue(eventId);
        
        // Recalcular estatísticas para garantir consistência
        await this.recalculateEventStats(eventId);
        
        // Invalidar cache após limpeza
        this.invalidateCache(eventId);
      }
      
      // Após limpeza, verificar se ainda há reservas ativas
      const stillHasReservations = await this.checkForActiveReservations();
      if (!stillHasReservations) {
        this.logger.log('🧹 Limpeza completa - nenhuma reserva ativa restante');
        // Não desligar imediatamente, deixar o job de verificação periódica decidir
        this.lastActivityCheck = Date.now() - (this.INACTIVITY_THRESHOLD - 60000); // Forçar verificação em 1 minuto
      }
      
    } catch (error: any) {
      this.logger.error(`Erro na limpeza de reservas expiradas: ${error.message}`, error.stack);
    }
  }

  /**
   * Processa a fila automaticamente quando há demanda
   */
  async releaseNewBatch(eventId: string): Promise<void> {
    try {
      const db = this.firestoreService.firestore;
      
      // Verificar se há pessoas na fila
      const queueRef = db.collection('queue').where('eventId', '==', eventId);
      const queueSnapshot = await queueRef.get();
      
      if (queueSnapshot.size > 0) {
        this.logger.log(`Processando fila com ${queueSnapshot.size} pessoas para evento ${eventId}`);
        
        // Processar fila para promover pessoas
        await this.processQueue(eventId);
      }
    } catch (error: any) {
      this.logger.error(`Erro ao processar fila: ${error.message}`, error.stack);
    }
  }

  /**
   * Recalcula as estatísticas do evento com base nos dados reais do banco
   */
  async recalculateEventStats(eventId: string): Promise<void> {
    try {
      this.logger.log(`Recalculando estatísticas para evento: ${eventId}`);
      
      const db = this.firestoreService.firestore;
      
      // Buscar todas as reservas da reservationHistory para este evento
      const reservationHistoryRef = db
        .collection('reservationHistory')
        .where('eventId', '==', eventId);
      
      const reservationHistorySnapshot = await reservationHistoryRef.get();
      
      // Buscar também as reservas ativas da collection reservations
      const reservationsRef = db
        .collection('reservations')
        .where('eventId', '==', eventId);
      
      const reservationsSnapshot = await reservationsRef.get();
      
      // Contar por status e gênero
      let totalReserved = 0;
      let totalPaid = 0;
      let maleReserved = 0;
      let malePaid = 0;
      let femaleReserved = 0;
      let femalePaid = 0;
      
      // Usar Set para evitar contar a mesma pessoa duas vezes
      const processedEmails = new Set<string>();
      
      // Primeiro, coletar todos os status únicos para debug
      const statusCounts = new Map<string, number>();
      
      // PRIORIZAR reservations (dados mais recentes) primeiro
      reservationsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data() as ReservationData;
        const email = data.email;
        
        // Marcar este email como processado
        processedEmails.add(email);
        
        // Contar tipos de status
        const currentCount = statusCounts.get(data.status) || 0;
        statusCounts.set(data.status, currentCount + 1);
        
        if (data.status === 'reserved') {
          totalReserved++;
          if (data.gender === 'male') {
            maleReserved++;
          } else if (data.gender === 'female') {
            femaleReserved++;
          }
        } else if (data.status === 'Pago') {
          totalPaid++;
          if (data.gender === 'male') {
            malePaid++;
          } else if (data.gender === 'female') {
            femalePaid++;
          }
        }
      });
      
      // Depois processar reservationHistory, MAS apenas para emails NÃO processados
      reservationHistorySnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        const email = data.email;
        
        // PULAR se este email já foi processado em reservations
        if (processedEmails.has(email)) {
          return;
        }
        
        // Contar tipos de status
        const currentCount = statusCounts.get(data.status) || 0;
        statusCounts.set(data.status, currentCount + 1);
        
        // DEBUG: Log dos primeiros 5 documentos para ver a estrutura
        if (index < 5) {
          this.logger.log(`[DEBUG] reservationHistory doc ${index}:`, {
            status: data.status,
            gender: data.gender,
            email: data.email,
            allFields: Object.keys(data)
          });
        }
        
        // Mapeamento correto dos status da reservationHistory
        if (data.status === 'Processando') {
          // Status "Processando" = pessoas com reserva ativa
          totalReserved++;
          if (data.gender === 'male') {
            maleReserved++;
          } else if (data.gender === 'female') {
            femaleReserved++;
          }
        } else if (data.status === 'Pago' || data.status === 'available') {
          // Status "Pago" ou "available" = pessoas que completaram pagamento
          totalPaid++;
          if (data.gender === 'male') {
            malePaid++;
          } else if (data.gender === 'female') {
            femalePaid++;
          }
        }
      });
      
      // Log de todos os status encontrados
      this.logger.log(`[DEBUG] Status encontrados:`, Object.fromEntries(statusCounts));
      this.logger.log(`[DEBUG] Emails únicos processados: ${processedEmails.size}`);
      
      // Atualizar as estatísticas no banco
      const eventStatsRef = db.collection('eventStats').doc(eventId);
      await eventStatsRef.set({
        totalReserved,
        totalPaid,
        maleReserved,
        malePaid,
        femaleReserved,
        femalePaid,
        lastRecalculated: new Date(),
        totalInscritos: totalPaid // Total de pessoas que completaram o pagamento
      }, { merge: true });
      
      this.logger.log(`Estatísticas recalculadas para evento ${eventId}:`, {
        totalReserved,
        totalPaid,
        maleReserved,
        malePaid,
        femaleReserved,
        femalePaid,
        totalInscritos: totalPaid,
        sources: {
          reservationHistory: reservationHistorySnapshot.size,
          reservations: reservationsSnapshot.size
        }
      });
      
      // Invalidar cache após recalcular
      this.invalidateCache(eventId);
      
    } catch (error: any) {
      this.logger.error(`Erro ao recalcular estatísticas do evento ${eventId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Busca as estatísticas atuais do evento
   */
  async getEventStats(eventId: string): Promise<{
    totalReserved: number;
    totalPaid: number;
    totalInscritos: number;
    maleReserved: number;
    malePaid: number;
    femaleReserved: number;
    femalePaid: number;
    maxClientFemale: number;
    maxClientMale: number;
    maxGeneralSpots: number;
    maxStaffFemale: number;
    maxStaffMale: number;
    vagasDisponiveis: {
      male: number;
      female: number;
      total: number;
    };
  }> {
    // Tentar buscar do cache primeiro (TTL menor para stats)
    const cached = this.getCache<any>(this.eventStatsCache, eventId);
    if (cached) {
      return cached;
    }
    
    try {
      const db = this.firestoreService.firestore;
      
      // Buscar estatísticas atuais
      const eventStatsRef = db.collection('eventStats').doc(eventId);
      const eventStatsDoc = await eventStatsRef.get();
      
      let currentStats;
      
      if (!eventStatsDoc.exists || !eventStatsDoc.data()?.lastRecalculated) {
        // Se não há estatísticas ou estão desatualizadas, recalcular
        this.logger.log(`Estatísticas não encontradas para evento ${eventId}, recalculando...`);
        await this.recalculateEventStats(eventId);
        
        // Buscar novamente após recalcular
        const updatedEventStatsDoc = await eventStatsRef.get();
        currentStats = updatedEventStatsDoc.exists ? updatedEventStatsDoc.data() : {
          totalReserved: 0,
          totalPaid: 0,
          maleReserved: 0,
          malePaid: 0,
          femaleReserved: 0,
          femalePaid: 0
        };
      } else {
        currentStats = eventStatsDoc.data();
      }
      
      // Buscar configurações do evento (pode vir do cache)
      const settings = await this.getEventSettings(eventId);
      
      // Verificar tipo de evento
      const isGeneralEvent = settings.maxGeneralSpots > 0;
      const isGenderEvent = settings.maxClientFemale > 0 || settings.maxClientMale > 0 || 
                           settings.maxStaffFemale > 0 || settings.maxStaffMale > 0;
      
      // Calcular vagas disponíveis baseado no tipo de evento
      let maxTotal: number;
      let vagasDisponiveis: any;
      
      if (isGeneralEvent && !isGenderEvent) {
        // Evento GERAL - todas as vagas são compartilhadas
        maxTotal = settings.maxGeneralSpots;
        const occupiedTotal = (currentStats.totalReserved || 0) + (currentStats.totalPaid || 0);
        
        vagasDisponiveis = {
          male: Math.max(0, maxTotal - occupiedTotal), // Para evento geral, male e female têm as mesmas vagas disponíveis
          female: Math.max(0, maxTotal - occupiedTotal),
          total: Math.max(0, maxTotal - occupiedTotal)
        };
      } else if (isGenderEvent && !isGeneralEvent) {
        // Evento POR GÊNERO - vagas separadas por gênero
        const maxMale = settings.maxClientMale + settings.maxStaffMale;
        const maxFemale = settings.maxClientFemale + settings.maxStaffFemale;
        maxTotal = maxMale + maxFemale;
        
        const occupiedMale = (currentStats.maleReserved || 0) + (currentStats.malePaid || 0);
        const occupiedFemale = (currentStats.femaleReserved || 0) + (currentStats.femalePaid || 0);
        const occupiedTotal = (currentStats.totalReserved || 0) + (currentStats.totalPaid || 0);
        
        vagasDisponiveis = {
          male: Math.max(0, maxMale - occupiedMale),
          female: Math.max(0, maxFemale - occupiedFemale),
          total: Math.max(0, maxTotal - occupiedTotal)
        };
      } else {
        throw new Error(`Configuração inválida para evento ${eventId}: deve ter OU maxGeneralSpots > 0 OU campos por gênero > 0`);
      }

      const result = {
        totalReserved: currentStats.totalReserved || 0,
        totalPaid: currentStats.totalPaid || 0,
        totalInscritos: currentStats.totalPaid || 0, // Total de pessoas inscritas (que pagaram)
        maleReserved: currentStats.maleReserved || 0,
        malePaid: currentStats.malePaid || 0,
        femaleReserved: currentStats.femaleReserved || 0,
        femalePaid: currentStats.femalePaid || 0,
        maxClientFemale: settings.maxClientFemale,
        maxClientMale: settings.maxClientMale,
        maxGeneralSpots: settings.maxGeneralSpots,
        maxStaffFemale: settings.maxStaffFemale,
        maxStaffMale: settings.maxStaffMale,
        vagasDisponiveis,
        // Adicionar informação sobre o tipo de evento
        eventType: isGeneralEvent ? 'general' : 'gender'
      };
      
      // Cachear por menos tempo (10 segundos) pois stats mudam frequentemente
      this.setCache(this.eventStatsCache, eventId, result, 10 * 1000);
      
      return result;
    } catch (error: any) {
      this.logger.error(`Erro ao buscar estatísticas do evento ${eventId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Limpeza manual do cache para um evento específico
   */
  async clearEventCache(eventId: string): Promise<void> {
    this.invalidateCache(eventId);
    this.logger.log(`Cache do evento ${eventId} limpo manualmente`);
  }
  
  /**
   * Limpeza manual de todo o cache
   */
  async clearAllCache(): Promise<void> {
    this.eventStatsCache.clear();
    this.eventSettingsCache.clear();
    this.logger.log('Todo o cache foi limpo manualmente');
  }
  
  /**
   * Métodos públicos para controle manual dos jobs
   */
  async forceStartJobs(): Promise<void> {
    this.startJobs();
    this.logger.log('🔄 Jobs forçados a iniciar manualmente');
  }
  
  async forceStopJobs(): Promise<void> {
    this.stopJobs();
    this.logger.log('❌ Jobs forçados a parar manualmente');
  }
  
  async getJobsStatus(): Promise<{
    isActive: boolean;
    lastActivityCheck: string;
    timeSinceLastActivity: number;
    hasActiveReservations: boolean;
  }> {
    const hasActiveReservations = await this.checkForActiveReservations();
    
    return {
      isActive: this.isJobsActive,
      lastActivityCheck: new Date(this.lastActivityCheck).toISOString(),
      timeSinceLastActivity: Date.now() - this.lastActivityCheck,
      hasActiveReservations
    };
  }
  
  /**
   * Limpeza manual de dados antigos com status 'expired'
   */
  async cleanupLegacyData(): Promise<void> {
    return this.cleanupLegacyExpiredData();
  }

  /**
   * Força o recálculo das estatísticas de um evento específico
   */
  async forceRecalculateEventStats(eventId: string): Promise<void> {
    await this.recalculateEventStats(eventId);
    this.logger.log(`✅ Estatísticas do evento ${eventId} recalculadas manualmente`);
  }

  /**
   * Força o recálculo das estatísticas de todos os eventos
   */
  async forceRecalculateAllEventStats(): Promise<void> {
    try {
      const db = this.firestoreService.firestore;
      
      // Buscar todos os eventos únicos da reservationHistory
      const reservationHistorySnapshot = await db.collection('reservationHistory').get();
      const eventIds = new Set<string>();
      
      reservationHistorySnapshot.docs.forEach(doc => {
        const eventId = doc.data().eventId;
        if (eventId) {
          eventIds.add(eventId);
        }
      });
      
      // Buscar também eventos da collection reservations
      const reservationsSnapshot = await db.collection('reservations').get();
      reservationsSnapshot.docs.forEach(doc => {
        const eventId = doc.data().eventId;
        if (eventId) {
          eventIds.add(eventId);
        }
      });
      
      this.logger.log(`Recalculando estatísticas para ${eventIds.size} eventos...`);
      
      // Recalcular para cada evento
      for (const eventId of eventIds) {
        await this.recalculateEventStats(eventId);
      }
      
      this.logger.log(`✅ Estatísticas recalculadas para todos os ${eventIds.size} eventos`);
    } catch (error: any) {
      this.logger.error('Erro ao recalcular estatísticas de todos os eventos:', error);
      throw error;
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
      .where('status', 'in', ['reserved', 'Pago']);
    
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
