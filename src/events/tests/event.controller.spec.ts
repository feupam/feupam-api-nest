import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from '../events.controller';
import { EventsService } from '../events.service';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import { ReserveSpotDto } from '../dto/reserve-spot.dto';
import { TicketKind } from '../dto/enum-spot';
import { EventType, UserType } from '../dto/enum';

describe('EventsController', () => {
  let controller: EventsController;
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        {
          provide: EventsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            reserveSpot: jest.fn(),
            getAllReservationsByEvent: jest.fn(),
            getInstallments: jest.fn(),
            checkRegistrationStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an event', async () => {
      const createEventDto: CreateEventDto = {
        name: '',
        date: '',
        location: '',
        eventType: EventType.GENDER_SPECIFIC,
        maxGeneralSpots: '',
        startDate: '',
        endDate: '',
      };
      const result = {
        id: '',
        name: '',
        date: '',
        location: '',
        eventType: EventType.GENDER_SPECIFIC,
        maxClientMale: '',
        maxClientFemale: '',
        maxStaffMale: '',
        maxStaffFemale: '',
        maxGeneralSpots: '',
        startDate: '',
        endDate: '',
      };
      jest.spyOn(service, 'create').mockResolvedValue(result);

      expect(await controller.create(createEventDto)).toBe(result);
      expect(service.create).toHaveBeenCalledWith(createEventDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of events', async () => {
      const result = [
        {
          id: 'reservation1',
        },
      ];
      jest.spyOn(service, 'findAll').mockResolvedValue(result);

      expect(await controller.findAll()).toBe(result);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single event', async () => {
      const result = {
        id: 'reservation1',
      };
      const id = 'someId';
      jest.spyOn(service, 'findOne').mockResolvedValue(result);

      expect(await controller.findOne(id)).toBe(result);
      expect(service.findOne).toHaveBeenCalledWith(id);
    });
  });

  describe('update', () => {
    it('should update an event', async () => {
      const updateEventDto: UpdateEventDto = {
        location: 'igreja',
      };
      const result = {
        id: 'reservation1',
        location: 'igreja',
      };
      const id = 'someId';
      jest.spyOn(service, 'update').mockResolvedValue(result);

      expect(await controller.update(id, updateEventDto)).toBe(result);
      expect(service.update).toHaveBeenCalledWith(id, updateEventDto);
    });
  });

  describe('remove', () => {
    it('should remove an event', async () => {
      const result = {
        id: 'reservation1',
      };
      const id = 'someId';
      jest.spyOn(service, 'remove').mockResolvedValue(result);

      expect(await controller.remove(id)).toBe(result);
      expect(service.remove).toHaveBeenCalledWith(id);
    });
  });

  describe('reserveSpots', () => {
    it('should reserve a spot for an event', async () => {
      const reserveSpotDto: ReserveSpotDto = {
        eventId: '',
        userId: '',
        spots: [],
        ticket_kind: TicketKind.FULL,
        email: '',
        userType: UserType.CLIENT,
      };
      const result = {
        spotId: '',
        ticketKind: TicketKind.FULL,
        email: '',
        eventId: '',
        userId: '',
      };
      const id = 'someId';
      jest.spyOn(service, 'reserveSpot').mockResolvedValue(result);

      expect(await controller.reserveSpots(reserveSpotDto, id)).toBe(result);
      expect(service.reserveSpot).toHaveBeenCalledWith(
        expect.objectContaining({ ...reserveSpotDto, eventId: id }),
      );
    });
  });

  describe('getEventReservations', () => {
    it('should get reservations for an event', async () => {
      const result = [
        {
          id: 'reservation1',
        },
      ];
      const id = 'someId';
      jest
        .spyOn(service, 'getAllReservationsByEvent')
        .mockResolvedValue(result);

      expect(await controller.getEventReservations(id)).toBe(result);
      expect(service.getAllReservationsByEvent).toHaveBeenCalledWith(id);
    });
  });

  describe('getInstallments', () => {
    it('should get installments for an event', async () => {
      const result = [
        {
          installmentNumber: 1,
          interestRate: 0.0454,
        },
        {
          installmentNumber: 2,
          interestRate: 0.0266,
        },
      ];
      const id = 'someId';
      jest.spyOn(service, 'getInstallments').mockResolvedValue(result);

      expect(await controller.getInstallments(id)).toBe(result);
      expect(service.getInstallments).toHaveBeenCalledWith(id);
    });
  });

  describe('getRegistrationStatus', () => {
    it('should get registration status for an event', async () => {
      const result = { currentDate: new Date(), isOpen: true };
      const id = 'someId';
      jest.spyOn(service, 'checkRegistrationStatus').mockResolvedValue(result);

      expect(await controller.getRegistrationStatus(id)).toBe(result);
      expect(service.checkRegistrationStatus).toHaveBeenCalledWith(id);
    });
  });
});
export { EventsController };
