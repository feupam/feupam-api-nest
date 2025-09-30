import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ReservationService } from './reservation.service';

@Injectable()
export class QueueProcessorService implements OnModuleInit {
  private readonly logger = new Logger(QueueProcessorService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private readonly PROCESSING_INTERVAL_MS = 30000; // 30 segundos (reduzido para evitar spam de erros)

  constructor(
    private readonly reservationService: ReservationService,
  ) {}

  onModuleInit() {
    this.startQueueProcessor();
  }

  private startQueueProcessor(): void {
    this.logger.log('Iniciando processador de fila...');
    
    this.intervalId = setInterval(async () => {
      try {
        await this.processAllQueues();
      } catch (error: any) {
        this.logger.error(`Erro no processamento da fila: ${error.message}`);
      }
    }, this.PROCESSING_INTERVAL_MS);
  }

  private async processAllQueues(): Promise<void> {
    // Por simplicidade, vamos processar eventos ativos
    // Em um cenário real, você poderia ter uma lista de eventos ativos
    const activeEventIds = await this.getActiveEventIds();
    
    for (const eventId of activeEventIds) {
      await this.reservationService.processQueue(eventId);
    }
  }

  private async getActiveEventIds(): Promise<string[]> {
    // Buscar eventos ativos (que tenham reservas ou filas pendentes)
    try {
      const db = this.reservationService['firestoreService'].firestore;
      
      // Buscar eventos que têm reservas ativas
      const reservationsSnapshot = await db
        .collection('reservations')
        .where('status', '==', 'reserved')
        .get();
      
      // Buscar eventos que têm fila - consulta simples
      const queueSnapshot = await db
        .collection('queue')
        .get();
      
      const eventIds = new Set<string>();
      
      // Adicionar eventos com reservas ativas
      reservationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        eventIds.add(data.eventId);
      });
      
      // Adicionar eventos com fila
      queueSnapshot.docs.forEach(doc => {
        const data = doc.data();
        eventIds.add(data.eventId);
      });
      
      return Array.from(eventIds);
    } catch (error: any) {
      this.logger.error(`Erro ao buscar eventos ativos: ${error.message}`);
      return [];
    }
  }

  stopQueueProcessor(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log('Processador de fila parado.');
    }
  }
}
