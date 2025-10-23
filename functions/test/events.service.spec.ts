import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from '../src/events/events.service';
import { ReservationService } from '../src/reservation/reservation.service';
import { FirestoreService } from '../src/firebase/firebase.service';

/**
 * Testes Unitários do EventsService
 * 
 * Testa a lógica de controle de eventos e jobs
 */
describe('EventsService', () => {
  let service: EventsService;
  let reservationService: ReservationService;

  // Mock do ReservationService
  const mockReservationService = {
    forceStartJobs: jest.fn(),
    forceStopJobs: jest.fn(),
    getJobsStatus: jest.fn(),
    clearEventCache: jest.fn(),
    clearAllCache: jest.fn(),
    cleanupLegacyData: jest.fn(),
    getEventStats: jest.fn(),
    recalculateEventStats: jest.fn(),
  };

  // Mock do FirestoreService
  const mockFirestoreService = {
    getFirestore: jest.fn(),
    getAuth: jest.fn(),
  };

  beforeEach(async () => {
    // Limpar e resetar todos os mocks antes de cada teste
    jest.clearAllMocks();
    jest.restoreAllMocks();
    
    // Resetar implementações dos mocks
    mockReservationService.forceStartJobs.mockResolvedValue(undefined);
    mockReservationService.forceStopJobs.mockResolvedValue(undefined);
    mockReservationService.getJobsStatus.mockResolvedValue({
      isActive: false,
      lastActivityCheck: new Date().toISOString(),
      timeSinceLastActivity: 0,
      hasActiveReservations: false,
    });
    mockReservationService.clearEventCache.mockResolvedValue(undefined);
    mockReservationService.clearAllCache.mockResolvedValue(undefined);
    mockReservationService.cleanupLegacyData.mockResolvedValue(undefined);
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: ReservationService,
          useValue: mockReservationService,
        },
        {
          provide: FirestoreService,
          useValue: mockFirestoreService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    reservationService = module.get<ReservationService>(ReservationService);
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have ReservationService injected', () => {
      expect(reservationService).toBeDefined();
    });
  });

  describe('Job Control Methods', () => {
    describe('forceStartJobs', () => {
      it('should call reservationService.forceStartJobs', async () => {
        await service.forceStartJobs();
        
        expect(mockReservationService.forceStartJobs).toHaveBeenCalledTimes(1);
      });

      it('should not throw error', async () => {
        await expect(service.forceStartJobs()).resolves.not.toThrow();
      });

      it('should handle errors from reservationService', async () => {
        mockReservationService.forceStartJobs.mockRejectedValue(
          new Error('Job start failed')
        );

        await expect(service.forceStartJobs()).rejects.toThrow('Job start failed');
      });
    });

    describe('forceStopJobs', () => {
      it('should call reservationService.forceStopJobs', async () => {
        await service.forceStopJobs();
        
        expect(mockReservationService.forceStopJobs).toHaveBeenCalledTimes(1);
      });

      it('should not throw error', async () => {
        await expect(service.forceStopJobs()).resolves.not.toThrow();
      });

      it('should handle errors from reservationService', async () => {
        mockReservationService.forceStopJobs.mockRejectedValue(
          new Error('Job stop failed')
        );

        await expect(service.forceStopJobs()).rejects.toThrow('Job stop failed');
      });
    });

    describe('getJobsStatus', () => {
      it('should call reservationService.getJobsStatus', async () => {
        const mockStatus = {
          isActive: true,
          lastActivityCheck: '2025-10-23T17:00:00.000Z',
          timeSinceLastActivity: 1000,
          hasActiveReservations: true,
        };

        mockReservationService.getJobsStatus.mockResolvedValue(mockStatus);

        const result = await service.getJobsStatus();

        expect(mockReservationService.getJobsStatus).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockStatus);
      });

      it('should return correct status structure', async () => {
        const mockStatus = {
          isActive: false,
          lastActivityCheck: '2025-10-23T17:00:00.000Z',
          timeSinceLastActivity: 5000,
          hasActiveReservations: false,
        };

        mockReservationService.getJobsStatus.mockResolvedValue(mockStatus);

        const result = await service.getJobsStatus();

        expect(result).toHaveProperty('isActive');
        expect(result).toHaveProperty('lastActivityCheck');
        expect(result).toHaveProperty('timeSinceLastActivity');
        expect(result).toHaveProperty('hasActiveReservations');
      });

      it('should handle errors from reservationService', async () => {
        mockReservationService.getJobsStatus.mockRejectedValue(
          new Error('Status check failed')
        );

        await expect(service.getJobsStatus()).rejects.toThrow('Status check failed');
      });
    });
  });

  describe('Cache Management', () => {
    describe('clearEventCache', () => {
      it('should call reservationService.clearEventCache with correct eventId', async () => {
        const eventId = 'test-event-123';

        await service.clearEventCache(eventId);

        expect(mockReservationService.clearEventCache).toHaveBeenCalledWith(eventId);
        expect(mockReservationService.clearEventCache).toHaveBeenCalledTimes(1);
      });

      it('should not throw error', async () => {
        await expect(service.clearEventCache('any-event')).resolves.not.toThrow();
      });

      it('should handle multiple events', async () => {
        await service.clearEventCache('event1');
        await service.clearEventCache('event2');
        await service.clearEventCache('event3');

        expect(mockReservationService.clearEventCache).toHaveBeenCalledTimes(3);
      });
    });

    describe('clearAllCache', () => {
      it('should call reservationService.clearAllCache', async () => {
        await service.clearAllCache();

        expect(mockReservationService.clearAllCache).toHaveBeenCalledTimes(1);
      });

      it('should not throw error', async () => {
        await expect(service.clearAllCache()).resolves.not.toThrow();
      });

      it('should handle errors from reservationService', async () => {
        mockReservationService.clearAllCache.mockRejectedValue(
          new Error('Cache clear failed')
        );

        await expect(service.clearAllCache()).rejects.toThrow('Cache clear failed');
      });
    });
  });

  describe('Legacy Data Cleanup', () => {
    describe('cleanupLegacyData', () => {
      it('should call reservationService.cleanupLegacyData', async () => {
        await service.cleanupLegacyData();

        expect(mockReservationService.cleanupLegacyData).toHaveBeenCalledTimes(1);
      });

      it('should not throw error', async () => {
        await expect(service.cleanupLegacyData()).resolves.not.toThrow();
      });

      it('should handle errors from reservationService', async () => {
        mockReservationService.cleanupLegacyData.mockRejectedValue(
          new Error('Cleanup failed')
        );

        await expect(service.cleanupLegacyData()).rejects.toThrow('Cleanup failed');
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full job lifecycle', async () => {
      // Start jobs
      await service.forceStartJobs();
      expect(mockReservationService.forceStartJobs).toHaveBeenCalled();

      // Check status
      mockReservationService.getJobsStatus.mockResolvedValue({
        isActive: true,
        lastActivityCheck: new Date().toISOString(),
        timeSinceLastActivity: 100,
        hasActiveReservations: true,
      });

      const status = await service.getJobsStatus();
      expect(status.isActive).toBe(true);

      // Stop jobs
      await service.forceStopJobs();
      expect(mockReservationService.forceStopJobs).toHaveBeenCalled();
    });

    it('should handle cache operations during job execution', async () => {
      await service.forceStartJobs();
      await service.clearEventCache('event1');
      await service.clearAllCache();
      await service.forceStopJobs();

      expect(mockReservationService.forceStartJobs).toHaveBeenCalledTimes(1);
      expect(mockReservationService.clearEventCache).toHaveBeenCalledTimes(1);
      expect(mockReservationService.clearAllCache).toHaveBeenCalledTimes(1);
      expect(mockReservationService.forceStopJobs).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent operations', async () => {
      const operations = [
        service.forceStartJobs(),
        service.getJobsStatus(),
        service.clearEventCache('event1'),
      ];

      mockReservationService.getJobsStatus.mockResolvedValue({
        isActive: true,
        lastActivityCheck: new Date().toISOString(),
        timeSinceLastActivity: 50,
        hasActiveReservations: true,
      });

      await Promise.all(operations);

      expect(mockReservationService.forceStartJobs).toHaveBeenCalled();
      expect(mockReservationService.getJobsStatus).toHaveBeenCalled();
      expect(mockReservationService.clearEventCache).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors from ReservationService', async () => {
      mockReservationService.forceStartJobs.mockRejectedValue(
        new Error('Service error')
      );

      await expect(service.forceStartJobs()).rejects.toThrow('Service error');
    });

    it('should handle multiple failures gracefully', async () => {
      mockReservationService.forceStartJobs.mockRejectedValue(new Error('Error 1'));
      mockReservationService.getJobsStatus.mockRejectedValue(new Error('Error 2'));

      await expect(service.forceStartJobs()).rejects.toThrow('Error 1');
      await expect(service.getJobsStatus()).rejects.toThrow('Error 2');
    });
  });

  describe('Method Delegation', () => {
    it('should correctly delegate forceStartJobs', async () => {
      const spy = jest.spyOn(reservationService, 'forceStartJobs');
      
      await service.forceStartJobs();
      
      expect(spy).toHaveBeenCalled();
    });

    it('should correctly delegate forceStopJobs', async () => {
      const spy = jest.spyOn(reservationService, 'forceStopJobs');
      
      await service.forceStopJobs();
      
      expect(spy).toHaveBeenCalled();
    });

    it('should correctly delegate getJobsStatus', async () => {
      const spy = jest.spyOn(reservationService, 'getJobsStatus');
      
      mockReservationService.getJobsStatus.mockResolvedValue({
        isActive: false,
        lastActivityCheck: new Date().toISOString(),
        timeSinceLastActivity: 1000,
        hasActiveReservations: false,
      });
      
      await service.getJobsStatus();
      
      expect(spy).toHaveBeenCalled();
    });

    it('should correctly delegate clearEventCache', async () => {
      const spy = jest.spyOn(reservationService, 'clearEventCache');
      
      await service.clearEventCache('test-event');
      
      expect(spy).toHaveBeenCalledWith('test-event');
    });

    it('should correctly delegate clearAllCache', async () => {
      const spy = jest.spyOn(reservationService, 'clearAllCache');
      
      await service.clearAllCache();
      
      expect(spy).toHaveBeenCalled();
    });

    it('should correctly delegate cleanupLegacyData', async () => {
      const spy = jest.spyOn(reservationService, 'cleanupLegacyData');
      
      await service.cleanupLegacyData();
      
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical admin workflow', async () => {
      // Admin starts jobs
      await service.forceStartJobs();
      
      // Check status
      mockReservationService.getJobsStatus.mockResolvedValue({
        isActive: true,
        lastActivityCheck: '2025-10-23T17:02:45.152Z',
        timeSinceLastActivity: 367,
        hasActiveReservations: true,
      });
      
      let status = await service.getJobsStatus();
      expect(status.isActive).toBe(true);
      
      // Clear cache
      await service.clearAllCache();
      
      // Stop jobs
      await service.forceStopJobs();
      
      // Check status again
      mockReservationService.getJobsStatus.mockResolvedValue({
        isActive: false,
        lastActivityCheck: '2025-10-23T17:02:46.643Z',
        timeSinceLastActivity: 1491,
        hasActiveReservations: true,
      });
      
      status = await service.getJobsStatus();
      expect(status.isActive).toBe(false);
    });

    it('should handle event-specific cache clearing', async () => {
      const eventIds = ['FederaLideres', 'Event2', 'Event3'];
      
      for (const eventId of eventIds) {
        await service.clearEventCache(eventId);
      }
      
      expect(mockReservationService.clearEventCache).toHaveBeenCalledTimes(3);
      expect(mockReservationService.clearEventCache).toHaveBeenCalledWith('FederaLideres');
      expect(mockReservationService.clearEventCache).toHaveBeenCalledWith('Event2');
      expect(mockReservationService.clearEventCache).toHaveBeenCalledWith('Event3');
    });

    it('should handle status checks during active reservations', async () => {
      mockReservationService.getJobsStatus.mockResolvedValue({
        isActive: true,
        lastActivityCheck: new Date().toISOString(),
        timeSinceLastActivity: 500,
        hasActiveReservations: true,
      });

      const status = await service.getJobsStatus();
      
      expect(status.hasActiveReservations).toBe(true);
      expect(status.isActive).toBe(true);
    });
  });
});
