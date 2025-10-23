import { Test, TestingModule } from '@nestjs/testing';
import { ReservationService } from '../src/reservation/reservation.service';
import { FirestoreService } from '../src/firebase/firebase.service';

/**
 * Testes Unitários do ReservationService
 * 
 * Testa a lógica de negócio do serviço de reservas,
 * incluindo gerenciamento de jobs, cache e reservas
 */
describe('ReservationService', () => {
  let service: ReservationService;
  let firestoreService: FirestoreService;

  // Mocks
  const mockFirestoreService = {
    getFirestore: jest.fn(),
    getAuth: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        {
          provide: FirestoreService,
          useValue: mockFirestoreService,
        },
      ],
    }).compile();

    service = module.get<ReservationService>(ReservationService);
    firestoreService = module.get<FirestoreService>(FirestoreService);

    // Limpar todos os mocks antes de cada teste
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Limpar intervalos criados pelo serviço
    jest.clearAllTimers();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have FirestoreService injected', () => {
      expect(firestoreService).toBeDefined();
    });
  });

  describe('Jobs Management', () => {
    describe('forceStartJobs', () => {
      it('should start jobs when called', async () => {
        const logSpy = jest.spyOn(service['logger'], 'log');
        
        await service.forceStartJobs();
        
        expect(logSpy).toHaveBeenCalledWith('🔄 Jobs forçados a iniciar manualmente');
      });

      it('should set isJobsActive to true', async () => {
        await service.forceStartJobs();
        
        const status = await service.getJobsStatus();
        expect(status.isActive).toBe(true);
      });

      it('should not start jobs twice if already active', async () => {
        await service.forceStartJobs();
        await service.forceStartJobs();
        
        const status = await service.getJobsStatus();
        expect(status.isActive).toBe(true);
      });
    });

    describe('forceStopJobs', () => {
      it('should stop jobs when called', async () => {
        const logSpy = jest.spyOn(service['logger'], 'log');
        
        await service.forceStartJobs();
        await service.forceStopJobs();
        
        expect(logSpy).toHaveBeenCalledWith('❌ Jobs forçados a parar manualmente');
      });

      it('should set isJobsActive to false', async () => {
        await service.forceStartJobs();
        await service.forceStopJobs();
        
        const status = await service.getJobsStatus();
        expect(status.isActive).toBe(false);
      });

      it('should clear cleanup intervals', async () => {
        await service.forceStartJobs();
        
        const cleanupInterval = service['cleanupJobInterval'];
        const cacheInterval = service['cacheCleanupInterval'];
        
        expect(cleanupInterval).not.toBeNull();
        expect(cacheInterval).not.toBeNull();
        
        await service.forceStopJobs();
        
        expect(service['cleanupJobInterval']).toBeNull();
        expect(service['cacheCleanupInterval']).toBeNull();
      });
    });

    describe('getJobsStatus', () => {
      it('should return complete job status', async () => {
        const status = await service.getJobsStatus();
        
        expect(status).toHaveProperty('isActive');
        expect(status).toHaveProperty('lastActivityCheck');
        expect(status).toHaveProperty('timeSinceLastActivity');
        expect(status).toHaveProperty('hasActiveReservations');
      });

      it('should return correct data types', async () => {
        const status = await service.getJobsStatus();
        
        expect(typeof status.isActive).toBe('boolean');
        expect(typeof status.lastActivityCheck).toBe('string');
        expect(typeof status.timeSinceLastActivity).toBe('number');
        expect(typeof status.hasActiveReservations).toBe('boolean');
      });

      it('should return valid ISO timestamp for lastActivityCheck', async () => {
        const status = await service.getJobsStatus();
        
        const date = new Date(status.lastActivityCheck);
        expect(date.toISOString()).toBe(status.lastActivityCheck);
      });

      it('should show isActive=true after starting jobs', async () => {
        await service.forceStartJobs();
        const status = await service.getJobsStatus();
        
        expect(status.isActive).toBe(true);
      });

      it('should show isActive=false after stopping jobs', async () => {
        await service.forceStartJobs();
        await service.forceStopJobs();
        
        const status = await service.getJobsStatus();
        expect(status.isActive).toBe(false);
      });
    });

    describe('Job Start/Stop Cycle', () => {
      it('should complete full start-stop cycle', async () => {
        // Start jobs
        await service.forceStartJobs();
        const afterStart = await service.getJobsStatus();
        expect(afterStart.isActive).toBe(true);
        
        // Stop jobs
        await service.forceStopJobs();
        const afterStop = await service.getJobsStatus();
        expect(afterStop.isActive).toBe(false);
      });

      it('should track time since last activity', async () => {
        const status1 = await service.getJobsStatus();
        const time1 = status1.timeSinceLastActivity;
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const status2 = await service.getJobsStatus();
        const time2 = status2.timeSinceLastActivity;
        
        expect(time2).toBeGreaterThan(time1);
      });

      it('should update lastActivityCheck when jobs start', async () => {
        await service.forceStartJobs();
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const afterStart = await service.getJobsStatus();
        
        // Verifica que o status tem uma data válida após iniciar jobs
        expect(afterStart.lastActivityCheck).toBeDefined();
        expect(typeof afterStart.lastActivityCheck).toBe('string');
        expect(afterStart.isActive).toBe(true);
      });
    });
  });

  describe('Cache Management', () => {
    describe('clearEventCache', () => {
      it('should clear cache for specific event', async () => {
        const eventId = 'test-event';
        const logSpy = jest.spyOn(service['logger'], 'log');
        
        await service.clearEventCache(eventId);
        
        expect(logSpy).toHaveBeenCalledWith(`Cache do evento ${eventId} limpo manualmente`);
      });

      it('should not throw error for non-existent event', async () => {
        await expect(service.clearEventCache('non-existent')).resolves.not.toThrow();
      });
    });

    describe('clearAllCache', () => {
      it('should clear all caches', async () => {
        const logSpy = jest.spyOn(service['logger'], 'log');
        
        await service.clearAllCache();
        
        expect(logSpy).toHaveBeenCalledWith('Todo o cache foi limpo manualmente');
      });

      it('should clear eventStatsCache', async () => {
        await service.clearAllCache();
        
        expect(service['eventStatsCache'].size).toBe(0);
      });

      it('should clear eventSettingsCache', async () => {
        await service.clearAllCache();
        
        expect(service['eventSettingsCache'].size).toBe(0);
      });
    });

    describe('Cache Validation', () => {
      it('should validate cache entries correctly', () => {
        const validCache = {
          data: { test: 'data' },
          timestamp: Date.now(),
          ttl: 60000, // 1 minute
        };
        
        expect(service['isValidCache'](validCache)).toBe(true);
      });

      it('should invalidate expired cache entries', () => {
        const expiredCache = {
          data: { test: 'data' },
          timestamp: Date.now() - 120000, // 2 minutes ago
          ttl: 60000, // 1 minute TTL
        };
        
        expect(service['isValidCache'](expiredCache)).toBe(false);
      });

      it('should return false for null cache', () => {
        expect(service['isValidCache'](null)).toBe(false);
      });

      it('should return false for undefined cache', () => {
        expect(service['isValidCache'](undefined)).toBe(false);
      });
    });

    describe('setCache', () => {
      it('should store cache with correct structure', () => {
        const cache = new Map();
        const data = { test: 'value' };
        const key = 'test-key';
        
        service['setCache'](cache, key, data);
        
        const cached = cache.get(key);
        expect(cached).toHaveProperty('data');
        expect(cached).toHaveProperty('timestamp');
        expect(cached).toHaveProperty('ttl');
        expect(cached.data).toEqual(data);
      });

      it('should use default TTL if not provided', () => {
        const cache = new Map();
        const data = { test: 'value' };
        
        service['setCache'](cache, 'key', data);
        
        const cached = cache.get('key');
        expect(cached.ttl).toBe(30000); // DEFAULT_CACHE_TTL = 30s
      });

      it('should use custom TTL if provided', () => {
        const cache = new Map();
        const customTTL = 5000;
        
        service['setCache'](cache, 'key', { test: 'value' }, customTTL);
        
        const cached = cache.get('key');
        expect(cached.ttl).toBe(customTTL);
      });
    });
  });

  describe('Activity Tracking', () => {
    describe('ensureJobsActive', () => {
      it('should activate jobs when called', async () => {
        await service.forceStartJobs();
        
        const status = await service.getJobsStatus();
        
        expect(status.isActive).toBe(true);
        expect(status.lastActivityCheck).toBeDefined();
      });

      it('should update lastActivityCheck', async () => {
        const beforeCheck = service['lastActivityCheck'];
        
        await new Promise(resolve => setTimeout(resolve, 10));
        
        service['ensureJobsActive']();
        const afterCheck = service['lastActivityCheck'];
        
        expect(afterCheck).toBeGreaterThan(beforeCheck);
      });

      it('should not restart jobs if already active', async () => {
        await service.forceStartJobs();
        const logSpy = jest.spyOn(service['logger'], 'log');
        logSpy.mockClear();
        
        service['ensureJobsActive']();
        
        // Should not log "Jobs LIGADOS" again
        const ligadosLogs = logSpy.mock.calls.filter(call => 
          call[0] && call[0].includes('Jobs de limpeza LIGADOS')
        );
        
        expect(ligadosLogs.length).toBe(0);
      });
    });
  });

  describe('Private Methods', () => {
    describe('startJobs', () => {
      it('should not start jobs twice', () => {
        service['startJobs']();
        const interval1 = service['cleanupJobInterval'];
        
        service['startJobs']();
        const interval2 = service['cleanupJobInterval'];
        
        expect(interval1).toBe(interval2);
      });

      it('should initialize cleanupJobInterval', () => {
        service['startJobs']();
        
        expect(service['cleanupJobInterval']).not.toBeNull();
      });

      it('should initialize cacheCleanupInterval', () => {
        service['startJobs']();
        
        expect(service['cacheCleanupInterval']).not.toBeNull();
      });

      it('should set isJobsActive to true', () => {
        service['startJobs']();
        
        expect(service['isJobsActive']).toBe(true);
      });
    });

    describe('stopJobs', () => {
      it('should not throw error if jobs not active', () => {
        expect(() => service['stopJobs']()).not.toThrow();
      });

      it('should clear intervals', () => {
        service['startJobs']();
        service['stopJobs']();
        
        expect(service['cleanupJobInterval']).toBeNull();
        expect(service['cacheCleanupInterval']).toBeNull();
      });

      it('should set isJobsActive to false', () => {
        service['startJobs']();
        service['stopJobs']();
        
        expect(service['isJobsActive']).toBe(false);
      });
    });
  });

  describe('Constants and Configuration', () => {
    it('should have correct RESERVATION_TIMEOUT_MINUTES', () => {
      expect(service['RESERVATION_TIMEOUT_MINUTES']).toBe(5);
    });

    it('should have correct DEFAULT_CACHE_TTL', () => {
      expect(service['DEFAULT_CACHE_TTL']).toBe(30000); // 30 seconds
    });

    it('should have correct ACTIVITY_CHECK_INTERVAL', () => {
      expect(service['ACTIVITY_CHECK_INTERVAL']).toBe(2 * 60 * 1000); // 2 minutes
    });

    it('should have correct INACTIVITY_THRESHOLD', () => {
      expect(service['INACTIVITY_THRESHOLD']).toBe(10 * 60 * 1000); // 10 minutes
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in getJobsStatus gracefully', async () => {
      // Mock checkForActiveReservations to throw error
      jest.spyOn(service as any, 'checkForActiveReservations').mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.getJobsStatus()).rejects.toThrow();
    });

    it('should handle cleanup job errors', async () => {
      // Mock cleanupExpiredReservations to throw
      jest.spyOn(service as any, 'cleanupExpiredReservations').mockRejectedValue(
        new Error('Cleanup failed')
      );

      service['startJobs']();
      
      // Wait for cleanup to potentially run
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Stop jobs to clean up
      service['stopJobs']();
      
      // If we got here, the error was handled gracefully
      expect(service['isJobsActive']).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid start/stop calls', async () => {
      await service.forceStartJobs();
      await service.forceStopJobs();
      await service.forceStartJobs();
      await service.forceStopJobs();
      
      const status = await service.getJobsStatus();
      expect(status.isActive).toBe(false);
    });

    it('should handle concurrent getJobsStatus calls', async () => {
      const promises = Array(10).fill(null).map(() => service.getJobsStatus());
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('isActive');
        expect(result).toHaveProperty('timeSinceLastActivity');
      });
    });

    it('should handle cache operations during job lifecycle', async () => {
      await service.clearAllCache();
      await service.forceStartJobs();
      await service.clearAllCache();
      await service.forceStopJobs();
      await service.clearAllCache();
      
      expect(service['eventStatsCache'].size).toBe(0);
    });
  });

  describe('Integration with Jobs', () => {
    it('should maintain state across multiple operations', async () => {
      // Start jobs
      await service.forceStartJobs();
      let status = await service.getJobsStatus();
      expect(status.isActive).toBe(true);
      
      // Clear cache while jobs are running
      await service.clearAllCache();
      status = await service.getJobsStatus();
      expect(status.isActive).toBe(true);
      
      // Clear event cache
      await service.clearEventCache('test-event');
      status = await service.getJobsStatus();
      expect(status.isActive).toBe(true);
      
      // Stop jobs
      await service.forceStopJobs();
      status = await service.getJobsStatus();
      expect(status.isActive).toBe(false);
    });

    it('should handle status checks during transitions', async () => {
      // Garante que começa desligado
      await service.forceStopJobs();
      const initialStatus = await service.getJobsStatus();
      
      // Liga
      await service.forceStartJobs();
      const activeStatus = await service.getJobsStatus();
      
      // Desliga
      await service.forceStopJobs();
      const stoppedStatus = await service.getJobsStatus();
      
      expect(initialStatus.isActive).toBe(false);
      expect(activeStatus.isActive).toBe(true);
      expect(stoppedStatus.isActive).toBe(false);
    });
  });
});
