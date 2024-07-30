import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventType, UserType, Gender } from './dto/enum';
import { TicketStatus, SpotStatus, TicketKind } from '../spots/dto/enum';

describe('EventsService', () => {
  let service: EventsService;

  const mockData = {
    eventGeneral: {
      eventId: 'eventId123',
      eventType: EventType.GENERAL,
      maxGeneralSpots: 10,
    },
    eventGenderSpecific: {
      eventId: 'eventId456',
      eventType: EventType.GENDER_SPECIFIC,
      maxClientMale: 5,
      maxClientFemale: 5,
      maxStaffMale: 2,
      maxStaffFemale: 2,
    },
    spots: {
      Spot1: {
        id: 'spot1Id',
        name: 'Spot1',
        gender: Gender.MALE,
        status: SpotStatus.available,
      },
      Spot2: {
        id: 'spot2Id',
        name: 'Spot2',
        gender: Gender.FEMALE,
        status: SpotStatus.available,
      },
    },
    reservationHistory: [],
  };

  const mockEventsService = {
    getEventData: jest.fn().mockImplementation((eventId: string) => {
      if (eventId === mockData.eventGeneral.eventId) {
        return mockData.eventGeneral;
      }
      if (eventId === mockData.eventGenderSpecific.eventId) {
        return mockData.eventGenderSpecific;
      }
      throw new NotFoundException('Event not found');
    }),
    getSpots: jest.fn().mockImplementation(() => {
      return Object.values(mockData.spots);
    }),
    checkUserReservation: jest
      .fn()
      .mockImplementation((email: string, eventId: string) => {
        const found = mockData.reservationHistory.some(
          (reservation) =>
            reservation.email === email && reservation.eventId === eventId,
        );
        return found;
      }),
    createReservation: jest.fn().mockImplementation((reservation) => {
      mockData.reservationHistory.push(reservation);
      return reservation;
    }),
    updateSpotStatus: jest.fn().mockImplementation((spotId, status) => {
      if (mockData.spots[spotId]) {
        mockData.spots[spotId].status = status;
      }
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reserveSpot', async () => {
    it('should reserve spot for general event with client', async () => {
      const dto = {
        eventId: mockData.eventGeneral.eventId,
        userType: UserType.CLIENT,
        email: 'client@example.com',
        spots: ['Spot1', 'Spot2'],
        ticket_kind: TicketKind.FULL,
      };

      const result = await service.reserveSpot(dto);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            spotId: expect.any(String),
            ticketKind: dto.ticket_kind,
            email: dto.email,
            eventId: dto.eventId,
          }),
        ]),
      );

      expect(mockEventsService.createReservation).toHaveBeenCalledTimes(2);
      expect(mockEventsService.updateSpotStatus).toHaveBeenCalledTimes(2);
    });

    it('should reserve spot for general event with staff', async () => {
      const dto = {
        eventId: mockData.eventGeneral.eventId,
        userType: UserType.STAFF,
        email: 'staff@example.com',
        spots: ['Spot1'],
        ticket_kind: TicketKind.FULL,
      };

      const result = await service.reserveSpot(dto);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            spotId: expect.any(String),
            ticketKind: dto.ticket_kind,
            email: dto.email,
            eventId: dto.eventId,
          }),
        ]),
      );

      expect(mockEventsService.createReservation).toHaveBeenCalledTimes(1);
      expect(mockEventsService.updateSpotStatus).toHaveBeenCalledTimes(1);
    });

    it('should reserve spot for gender-specific event with client', async () => {
      const dto = {
        eventId: mockData.eventGenderSpecific.eventId,
        userType: UserType.CLIENT,
        gender: Gender.MALE,
        email: 'client@example.com',
        spots: ['Spot1'],
        ticket_kind: TicketKind.FULL,
      };

      const result = await service.reserveSpot(dto);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            spotId: expect.any(String),
            ticketKind: dto.ticket_kind,
            email: dto.email,
            eventId: dto.eventId,
          }),
        ]),
      );

      expect(mockEventsService.createReservation).toHaveBeenCalledTimes(1);
      expect(mockEventsService.updateSpotStatus).toHaveBeenCalledTimes(1);
    });

    it('should reserve spot for gender-specific event with staff', async () => {
      const dto = {
        eventId: mockData.eventGenderSpecific.eventId,
        userType: UserType.STAFF,
        gender: Gender.MALE,
        email: 'staff@example.com',
        spots: ['Spot1'],
        ticket_kind: TicketKind.FULL,
      };

      const result = await service.reserveSpot(dto);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            spotId: expect.any(String),
            ticketKind: dto.ticket_kind,
            email: dto.email,
            eventId: dto.eventId,
          }),
        ]),
      );

      expect(mockEventsService.createReservation).toHaveBeenCalledTimes(1);
      expect(mockEventsService.updateSpotStatus).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException if general event exceeds max spots', async () => {
      // Reservando todas as vagas disponíveis
      mockData.reservationHistory.push(
        ...Array.from({ length: mockData.eventGeneral.maxGeneralSpots }).map(
          (_, index) => ({
            spotId: `spot${index + 1}Id`,
            ticketKind: TicketKind.FULL,
            email: `client${index}@example.com`,
            status: TicketStatus.reserved,
            userType: UserType.CLIENT,
            gender: Gender.MALE,
            eventId: mockData.eventGeneral.eventId,
          }),
        ),
      );

      const dto = {
        eventId: mockData.eventGeneral.eventId,
        userType: UserType.CLIENT,
        email: 'clientExtra@example.com',
        spots: ['Spot1'],
        ticket_kind: TicketKind.FULL,
      };

      await expect(service.reserveSpot(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    mockData.reservationHistory.push(
      ...Array.from(
        { length: mockData.eventGenderSpecific.maxClientMale },
        (_, index) => ({
          spotId: `spot${index + 1}Id`,
          ticketKind: TicketKind.FULL,
          email: `clientMale${index}@example.com`,
          status: TicketStatus.reserved,
          userType: UserType.CLIENT,
          gender: Gender.MALE,
          eventId: mockData.eventGenderSpecific.eventId,
        }),
      ),
    );

    const dto = {
      eventId: mockData.eventGenderSpecific.eventId,
      userType: UserType.CLIENT,
      gender: Gender.MALE,
      email: 'clientExtra@example.com',
      spots: ['Spot1'],
      ticket_kind: TicketKind.FULL,
    };

    await expect(service.reserveSpot(dto)).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if event does not exist', async () => {
    const dto = {
      eventId: 'nonExistingEventId',
      userType: UserType.CLIENT,
      email: 'test@example.com',
      spots: ['Spot1'],
      ticket_kind: TicketKind.FULL,
    };

    await expect(service.reserveSpot(dto)).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if user already has a reservation', async () => {
    mockData.reservationHistory.push({
      spotId: 'spot1Id',
      ticketKind: TicketKind.FULL,
      email: 'test@example.com',
      status: TicketStatus.reserved,
      userType: UserType.CLIENT,
      gender: Gender.MALE,
      eventId: mockData.eventGeneral.eventId,
    });

    const dto = {
      eventId: mockData.eventGenderSpecific.eventId,
      userType: UserType.CLIENT,
      gender: Gender.MALE,
      email: 'clientExtra@example.com',
      spots: ['Spot1'],
      ticket_kind: TicketKind.FULL,
    };

    await expect(service.reserveSpot(dto)).rejects.toThrow(BadRequestException);
  });
});
