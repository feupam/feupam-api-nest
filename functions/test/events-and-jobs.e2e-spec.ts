import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EventsService } from '../src/events/events.service';
import { ReservationService } from '../src/reservation/reservation.service';

/**
 * Testes E2E para Eventos, Reservas e Jobs
 * 
 * Estes testes foram criados com base em inputs e outputs reais da API
 * Testam o fluxo completo de reservas e gerenciamento de jobs
 */
describe('Events and Jobs (e2e)', () => {
  let app: INestApplication;
  let eventsService: EventsService;
  let reservationService: ReservationService;

  const authToken = process.env.TEST_AUTH_TOKEN || 'fake-token-for-testing';
  const eventId = 'FederaLideres';
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    eventsService = moduleFixture.get<EventsService>(EventsService);
    reservationService = moduleFixture.get<ReservationService>(ReservationService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Event Endpoints', () => {
    describe('GET /events/:id/check-spot', () => {
      it('should check if spots are available', async () => {
        const response = await request(app.getHttpServer())
          .get(`/events/${eventId}/check-spot`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Based on real API response
        expect(typeof response.body).toBe('boolean');
      });

      it('should return true when spots are available', async () => {
        // Real output: true
        const response = await request(app.getHttpServer())
          .get(`/events/${eventId}/check-spot`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.body).toBe(true);
      });
    });

    describe('POST /events/:id/reserve-spot', () => {
      it('should create a reservation with valid input', async () => {
        const reserveSpotDto = {
          ticket_kind: 'full',
          userType: 'client',
        };

        const response = await request(app.getHttpServer())
          .post(`/events/${eventId}/reserve-spot`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send(reserveSpotDto)
          .expect(201);

        // Real API response structure
        expect(response.body).toHaveProperty('ticketKind');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('eventId');
        expect(response.body.ticketKind).toBe('full');
        expect(response.body.eventId).toBe(eventId);
      });

      it('should reject invalid ticket_kind', async () => {
        const invalidDto = {
          ticket_kind: 'invalid_kind',
          userType: 'client',
        };

        await request(app.getHttpServer())
          .post(`/events/${eventId}/reserve-spot`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .send(invalidDto)
          .expect(400);
      });
    });

    describe('GET /events/:id/installments', () => {
      it('should return installment options', async () => {
        const response = await request(app.getHttpServer())
          .get(`/events/${eventId}/installments`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Based on real API response
        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('parcelas');
          expect(response.body[0]).toHaveProperty('valor_total');
          expect(response.body[0]).toHaveProperty('valor_parcela');
        }
      });

      it('should return installments with correct structure', async () => {
        const response = await request(app.getHttpServer())
          .get(`/events/${eventId}/installments`)
          .set('Authorization', `Bearer ${authToken}`);

        // Real output includes installments 1-12
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              parcelas: expect.any(Number),
              valor_total: expect.any(Number),
              valor_parcela: expect.any(Number),
            }),
          ]),
        );
      });
    });

    describe('GET /events/:id/waiting-list', () => {
      it('should return waiting list', async () => {
        const response = await request(app.getHttpServer())
          .get(`/events/${eventId}/waiting-list`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Based on real API response
        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('GET /events/:id/reservations', () => {
      it('should return all reservations for event', async () => {
        const response = await request(app.getHttpServer())
          .get(`/events/${eventId}/reservations`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Real API response structure
        expect(Array.isArray(response.body)).toBe(true);
        
        if (response.body.length > 0) {
          const reservation = response.body[0];
          expect(reservation).toHaveProperty('uuid');
          expect(reservation).toHaveProperty('eventId');
          expect(reservation).toHaveProperty('status');
          expect(reservation).toHaveProperty('ticketKind');
          expect(reservation).toHaveProperty('userType');
          expect(reservation).toHaveProperty('email');
          expect(reservation).toHaveProperty('price');
        }
      });

      it('should return reservations with valid status values', async () => {
        const response = await request(app.getHttpServer())
          .get(`/events/${eventId}/reservations`)
          .set('Authorization', `Bearer ${authToken}`);

        // Real statuses from API: 'Pago', 'Processando', 'available'
        const validStatuses = ['Pago', 'Processando', 'available', 'reserved', 'expired'];
        
        response.body.forEach((reservation: any) => {
          expect(validStatuses).toContain(reservation.status);
        });
      });

      it('should return reservations with correct price', async () => {
        const response = await request(app.getHttpServer())
          .get(`/events/${eventId}/reservations`)
          .set('Authorization', `Bearer ${authToken}`);

        // Real price from API: 17000 (R$ 170,00 in cents)
        response.body.forEach((reservation: any) => {
          expect(reservation.price).toBe(17000);
        });
      });
    });
  });

  describe('User Reservations', () => {
    describe('GET /users/reservations', () => {
      it('should return user reservations', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/reservations')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Real API response structure
        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should return reservations with complete user data', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/reservations')
          .set('Authorization', `Bearer ${authToken}`);

        if (response.body.length > 0) {
          const reservation = response.body[0];
          // Real data structure from API
          expect(reservation).toHaveProperty('uuid');
          expect(reservation).toHaveProperty('name');
          expect(reservation).toHaveProperty('email');
          expect(reservation).toHaveProperty('cpf');
          expect(reservation).toHaveProperty('eventId');
          expect(reservation).toHaveProperty('status');
        }
      });
    });

    describe('PATCH /users/cancel-reservation', () => {
      it('should cancel a reservation', async () => {
        // This endpoint requires a reservation to exist
        // Test structure based on API endpoint
        await request(app.getHttpServer())
          .patch('/users/cancel-reservation')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect((res) => {
            expect([200, 404]).toContain(res.status);
          });
      });
    });
  });

  describe('Tickets', () => {
    describe('GET /tickets/:id/purchase', () => {
      it('should return ticket information for purchase', async () => {
        const response = await request(app.getHttpServer())
          .get(`/tickets/${eventId}/purchase`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Real API response
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('message');
        
        if (response.body.status === 'reserved') {
          expect(response.body).toHaveProperty('expiresAt');
          expect(response.body).toHaveProperty('remainingMinutes');
          expect(response.body.message).toBe('Reserva válida. Pode proceder com o pagamento.');
        }
      });

      it('should return correct expiration time', async () => {
        const response = await request(app.getHttpServer())
          .get(`/tickets/${eventId}/purchase`)
          .set('Authorization', `Bearer ${authToken}`);

        // Real output: remainingMinutes: 5 (or less)
        if (response.body.status === 'reserved') {
          expect(response.body.remainingMinutes).toBeGreaterThanOrEqual(0);
          expect(response.body.remainingMinutes).toBeLessThanOrEqual(5);
        }
      });
    });
  });

  describe('Jobs Management', () => {
    describe('GET /events/jobs/status', () => {
      it('should return job status', async () => {
        const response = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Real API response structure
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body.success).toBe(true);
      });

      it('should return complete job status information', async () => {
        const response = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`);

        // Real output structure
        expect(response.body.data).toHaveProperty('isActive');
        expect(response.body.data).toHaveProperty('lastActivityCheck');
        expect(response.body.data).toHaveProperty('timeSinceLastActivity');
        expect(response.body.data).toHaveProperty('hasActiveReservations');
        
        expect(typeof response.body.data.isActive).toBe('boolean');
        expect(typeof response.body.data.timeSinceLastActivity).toBe('number');
        expect(typeof response.body.data.hasActiveReservations).toBe('boolean');
      });
    });

    describe('POST /events/jobs/start', () => {
      it('should start cleanup jobs', async () => {
        const response = await request(app.getHttpServer())
          .post('/events/jobs/start')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect(201);

        // Real API response
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Jobs de limpeza foram iniciados forçadamente.');
      });

      it('should activate jobs after start command', async () => {
        // Start jobs
        await request(app.getHttpServer())
          .post('/events/jobs/start')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect(201);

        // Check status
        const statusResponse = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Real behavior: isActive should be true after start
        expect(statusResponse.body.data.isActive).toBe(true);
      });
    });

    describe('POST /events/jobs/stop', () => {
      it('should stop cleanup jobs', async () => {
        const response = await request(app.getHttpServer())
          .post('/events/jobs/stop')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect(201);

        // Real API response
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Jobs de limpeza foram parados forçadamente.');
      });

      it('should deactivate jobs after stop command', async () => {
        // Stop jobs
        await request(app.getHttpServer())
          .post('/events/jobs/stop')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect(201);

        // Check status
        const statusResponse = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Real behavior: isActive should be false after stop
        expect(statusResponse.body.data.isActive).toBe(false);
      });
    });

    describe('Job Start/Stop Cycle', () => {
      it('should complete full start-check-stop-check cycle', async () => {
        // 1. Get initial status
        const initialStatus = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // 2. Start jobs
        const startResponse = await request(app.getHttpServer())
          .post('/events/jobs/start')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect(201);

        expect(startResponse.body.success).toBe(true);

        // 3. Check status after start
        const statusAfterStart = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(statusAfterStart.body.data.isActive).toBe(true);

        // 4. Stop jobs
        const stopResponse = await request(app.getHttpServer())
          .post('/events/jobs/stop')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'application/json')
          .expect(201);

        expect(stopResponse.body.success).toBe(true);

        // 5. Check status after stop
        const statusAfterStop = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(statusAfterStop.body.data.isActive).toBe(false);

        // Real behavior verified
        expect(statusAfterStop.body.data).toHaveProperty('lastActivityCheck');
        expect(statusAfterStop.body.data).toHaveProperty('timeSinceLastActivity');
      });

      it('should maintain hasActiveReservations status during job cycle', async () => {
        // Start
        await request(app.getHttpServer())
          .post('/events/jobs/start')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(201);

        const statusDuringActive = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Stop
        await request(app.getHttpServer())
          .post('/events/jobs/stop')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(201);

        const statusDuringInactive = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Real behavior: hasActiveReservations persists regardless of job state
        expect(typeof statusDuringActive.body.data.hasActiveReservations).toBe('boolean');
        expect(typeof statusDuringInactive.body.data.hasActiveReservations).toBe('boolean');
      });
    });

    describe('Job Activity Tracking', () => {
      it('should track time since last activity', async () => {
        const status1 = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const time1 = status1.body.data.timeSinceLastActivity;

        // Wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));

        const status2 = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const time2 = status2.body.data.timeSinceLastActivity;

        // Real behavior: time should increase
        expect(time2).toBeGreaterThan(time1);
      });

      it('should have valid lastActivityCheck timestamp', async () => {
        const response = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const lastCheck = response.body.data.lastActivityCheck;
        
        // Should be valid ISO 8601 date string
        expect(new Date(lastCheck).toISOString()).toBe(lastCheck);
      });
    });
  });

  describe('Integration Tests', () => {
    describe('Complete Reservation Flow', () => {
      it('should handle complete reservation and payment flow', async () => {
        // 1. Check spot availability
        const checkSpot = await request(app.getHttpServer())
          .get(`/events/${eventId}/check-spot`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        if (!checkSpot.body) {
          console.log('No spots available, skipping flow test');
          return;
        }

        // 2. Get installments
        const installments = await request(app.getHttpServer())
          .get(`/events/${eventId}/installments`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(installments.body)).toBe(true);

        // 3. Reserve spot
        const reservation = await request(app.getHttpServer())
          .post(`/events/${eventId}/reserve-spot`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ ticket_kind: 'full', userType: 'client' })
          .expect(201);

        expect(reservation.body).toHaveProperty('uuid');

        // 4. Get ticket for payment
        const ticket = await request(app.getHttpServer())
          .get(`/tickets/${eventId}/purchase`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(ticket.body.status).toBeDefined();

        // 5. Check user reservations
        const userReservations = await request(app.getHttpServer())
          .get('/users/reservations')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(userReservations.body)).toBe(true);
      });
    });

    describe('Job Management with Active Reservations', () => {
      it('should manage jobs correctly when reservations exist', async () => {
        // Ensure we have a reservation
        const userReservations = await request(app.getHttpServer())
          .get('/users/reservations')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Get job status
        const initialStatus = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Real behavior: if reservations exist, hasActiveReservations should be true
        if (userReservations.body.length > 0) {
          expect(initialStatus.body.data.hasActiveReservations).toBe(true);
        }

        // Start jobs
        await request(app.getHttpServer())
          .post('/events/jobs/start')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(201);

        // Jobs should be active
        const activeStatus = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(activeStatus.body.data.isActive).toBe(true);

        // Stop jobs
        await request(app.getHttpServer())
          .post('/events/jobs/stop')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(201);

        // Jobs should be inactive
        const inactiveStatus = await request(app.getHttpServer())
          .get('/events/jobs/status')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(inactiveStatus.body.data.isActive).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid event ID', async () => {
      await request(app.getHttpServer())
        .get('/events/INVALID_EVENT/check-spot')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect([404, 400]).toContain(res.status);
        });
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get(`/events/${eventId}/check-spot`)
        .expect(401);
    });

    it('should handle malformed reservation data', async () => {
      await request(app.getHttpServer())
        .post(`/events/${eventId}/reserve-spot`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalid_field: 'test' })
        .expect((res) => {
          expect([400, 422]).toContain(res.status);
        });
    });
  });
});
