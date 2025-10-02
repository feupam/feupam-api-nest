/**
 * Script para testar o sistema de jobs dinâmicos
 * Demonstra como o sistema liga/desliga jobs automaticamente
 */

import { Injectable } from '@nestjs/common';
import { ReservationService } from '../reservation/reservation.service';

@Injectable()
export class DynamicJobsExample {
  constructor(private readonly reservationService: ReservationService) {}

  /**
   * Exemplo de como o sistema funciona
   */
  async demonstrateJobsBehavior(): Promise<void> {
    console.log('🎯 Demonstração do Sistema de Jobs Dinâmicos\n');

    // 1. Verificar status inicial
    console.log('1️⃣ Status inicial dos jobs:');
    const initialStatus = await this.reservationService.getJobsStatus();
    console.log(JSON.stringify(initialStatus, null, 2));
    console.log('\n');

    // 2. Simular criação de reserva (isso ativará os jobs)
    console.log('2️⃣ Simulando criação de reserva...');
    try {
      await this.reservationService.reserveSpot(
        'test@example.com',
        'event123',
        'male'
      );
      console.log('✅ Reserva criada - jobs devem estar ativos agora');
    } catch (error) {
      console.log('ℹ️ Erro esperado (evento não existe), mas jobs foram ativados');
    }

    // 3. Verificar status após atividade
    console.log('\n3️⃣ Status após atividade:');
    const activeStatus = await this.reservationService.getJobsStatus();
    console.log(JSON.stringify(activeStatus, null, 2));
    console.log('\n');

    // 4. Forçar parada dos jobs
    console.log('4️⃣ Forçando parada dos jobs...');
    await this.reservationService.forceStopJobs();
    
    const stoppedStatus = await this.reservationService.getJobsStatus();
    console.log(JSON.stringify(stoppedStatus, null, 2));
    console.log('\n');

    // 5. Forçar início dos jobs
    console.log('5️⃣ Forçando início dos jobs...');
    await this.reservationService.forceStartJobs();
    
    const restartedStatus = await this.reservationService.getJobsStatus();
    console.log(JSON.stringify(restartedStatus, null, 2));
    console.log('\n');

    console.log('🎉 Demonstração completa!');
    console.log('📋 Resumo do sistema:');
    console.log('- Jobs ligam automaticamente quando há reservas');
    console.log('- Jobs desligam após 10 minutos sem atividade');
    console.log('- Verificação automática a cada 2 minutos');
    console.log('- Controle manual disponível via API');
  }
}

export default DynamicJobsExample;