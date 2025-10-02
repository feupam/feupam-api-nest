/**
 * Script de exemplo para configurar as configurações de um evento
 * Execute este script para criar as configurações no Firestore
 */

import { FirestoreService } from '../firebase/firebase.service';
import { EventSettings } from '../reservation/reservation.service';

export class EventSetupScript {
  
  static async setupEventExample(firestoreService: FirestoreService, eventId: string) {
    const db = firestoreService.firestore;
    
    // Exemplo de configurações para um evento
    // Nota: Tempo de reserva é fixo em 5 minutos no código
    const eventSettings: EventSettings = {
      maxClientFemale: 47,                   // Clientes femininas
      maxClientMale: 50,                     // Clientes masculinos
      maxGeneralSpots: 0,                    // Vagas gerais (sem gênero)
      maxStaffFemale: 10,                    // Staff feminino
      maxStaffMale: 10                       // Staff masculino
    };
    
    try {
      // Criar/atualizar documento do evento com as configurações OBRIGATÓRIAS
      await db.collection('events').doc(eventId).set({
        maxClientFemale: eventSettings.maxClientFemale.toString(),
        maxClientMale: eventSettings.maxClientMale.toString(), 
        maxGeneralSpots: eventSettings.maxGeneralSpots.toString(),
        maxStaffFemale: eventSettings.maxStaffFemale.toString(),
        maxStaffMale: eventSettings.maxStaffMale.toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
      
      // Criar documento de estatísticas inicial
      await db.collection('eventStats').doc(eventId).set({
        totalPaid: 0,
        malePaid: 0,
        femalePaid: 0,
        totalReserved: 0,
        maleReserved: 0,
        femaleReserved: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
      
      console.log(`✅ Evento ${eventId} configurado com sucesso!`);
      console.log('Configurações:', eventSettings);
      
    } catch (error) {
      console.error(`❌ Erro ao configurar evento ${eventId}:`, error);
    }
  }
  
  /**
   * Exemplo de diferentes tipos de configurações para eventos
   * Nota: Tempo de reserva é fixo em 5 minutos no código
   */
  static getEventConfigExamples(): Record<string, EventSettings> {
    return {
      // Evento pequeno - festa íntima
      'evento-pequeno': {
        maxClientFemale: 20,
        maxClientMale: 20,
        maxGeneralSpots: 0,
        maxStaffFemale: 5,
        maxStaffMale: 5
      },
      
      // Evento médio - festa universitária
      'evento-medio': {
        maxClientFemale: 35,
        maxClientMale: 40,
        maxGeneralSpots: 10,
        maxStaffFemale: 8,
        maxStaffMale: 7
      },
      
      // Evento grande - festa principal
      'evento-grande': {
        maxClientFemale: 47,
        maxClientMale: 50,
        maxGeneralSpots: 0,
        maxStaffFemale: 10,
        maxStaffMale: 10
      },
      
      // Evento VIP - menor e mais exclusivo
      'evento-vip': {
        maxClientFemale: 10,
        maxClientMale: 10,
        maxGeneralSpots: 5,
        maxStaffFemale: 3,
        maxStaffMale: 2
      }
    };
  }
}

/**
 * Exemplo de uso do script:
 * 
 * // No seu controller ou service
 * import { EventSetupScript } from './scripts/setup-event-example';
 * 
 * // Configurar um evento específico
 * await EventSetupScript.setupEventExample(this.firestoreService, 'meu-evento-123');
 * 
 * // Ou use as configurações de exemplo
 * const configs = EventSetupScript.getEventConfigExamples();
 * const configEventoGrande = configs['evento-grande'];
 */