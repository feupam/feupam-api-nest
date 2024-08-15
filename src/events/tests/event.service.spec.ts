import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from '../events.service';
import { FirestoreService } from '../../firebase/firebase.service';
import { UserType, EventType, Gender } from '../dto/enum';
import { TicketKind } from '../dto/enum-spot';
import { CreateEventDto } from '../dto/create-event.dto';

describe('EventsService', () => {
  let service: EventsService;
  let mockFirestore: any;
  let mockEventDoc: Partial<CreateEventDto> & { exists: boolean; data: any };
  let mockSpotDocs: any;
  let mockTicketsDoc: any;
  let hasUserReservation: boolean; // Variável para controlar reservas
  let mockReservationHistoryDocs: any;

  beforeEach(async () => {
    hasUserReservation = false; // Inicialmente, o usuário não tem uma reserva

    // Mock do método data para o documento
    mockEventDoc = {
      exists: true,
      data: jest.fn().mockReturnValue({
        eventId: 'event1',
        eventType: EventType.GENERAL,
        maxClientMale: 10,
        maxClientFemale: 10,
        maxStaffMale: 5,
        maxStaffFemale: 5,
        maxGeneralSpots: 50,
        startDate: new Date(),
        endDate: new Date(new Date().setDate(new Date().getDate() + 1)),
      }),
    };

    mockTicketsDoc = {
      exists: true,
      data: jest.fn().mockReturnValue({
        eventId: 'event1',
        eventType: EventType.GENERAL,
        startDate: new Date(),
        endDate: new Date(new Date().setDate(new Date().getDate() + 1)),
      }),
    };

    // Mock dos documentos de spot
    mockSpotDocs = [
      {
        id: 'spot1',
        data: jest.fn().mockReturnValue({
          eventId: 'event1',
          userId: '1',
          spots: ['sd'],
          ticket_kind: TicketKind.FULL,
          userType: UserType.CLIENT,
          email: 'test@test.com',
          gender: Gender.MALE,
        }),
      },
      {
        id: 'spot2',
        data: jest.fn().mockReturnValue({
          eventId: 'event1',
          userId: '2',
          spots: ['sd2'],
          ticket_kind: TicketKind.FULL,
          userType: UserType.CLIENT,
          email: 'test2@test.com',
          gender: Gender.MALE,
        }),
      },
    ];

    // Mock dos documentos de reserva
    mockReservationHistoryDocs = hasUserReservation
      ? [
          {
            id: 'reservation1',
            data: jest.fn().mockReturnValue({
              email: 'user@example.com',
              eventId: 'event1',
            }),
          },
        ]
      : [];

    // Mock do Firestore para todas as coleções
    mockFirestore = {
      collection: jest.fn().mockImplementation((collectionName: string) => {
        if (collectionName === 'events') {
          return {
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(mockEventDoc),
            }),
          };
        } else if (collectionName === 'tickets') {
          return {
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(mockTicketsDoc),
            }),
          };
        } else if (collectionName === 'spots') {
          return {
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              empty: false,
              docs: mockSpotDocs,
            }),
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(mockSpotDocs),
            }),
          };
        } else if (collectionName === 'reservationHistory') {
          return {
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(mockReservationHistoryDocs),
            }),
            where: jest
              .fn()
              .mockImplementation(
                (field: string, operator: string, value: any) => {
                  if (
                    field === 'email' &&
                    operator === '==' &&
                    value === 'user@example.com'
                  ) {
                    return {
                      where: jest
                        .fn()
                        .mockImplementation(
                          (field: string, operator: string, value: any) => {
                            if (
                              field === 'eventId' &&
                              operator === '==' &&
                              value === 'event1'
                            ) {
                              return {
                                get: jest.fn().mockResolvedValue({
                                  empty:
                                    mockReservationHistoryDocs.length === 0,
                                  docs: mockReservationHistoryDocs,
                                }),
                              };
                            }
                            return {
                              get: jest.fn().mockResolvedValue({
                                empty: true,
                                docs: [],
                              }),
                            };
                          },
                        ),
                    };
                  }
                  return {
                    get: jest.fn().mockResolvedValue({
                      empty: true,
                      docs: [],
                    }),
                  };
                },
              ),
          };
        }
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({
            empty: true,
            docs: [],
          }),
        };
      }),
      batch: jest.fn().mockReturnValue({
        commit: jest.fn().mockResolvedValue(undefined),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
    };

    const mockFirestoreService = {
      firestore: mockFirestore,
      getFirestore: jest.fn().mockReturnValue(mockFirestore),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: FirestoreService,
          useValue: mockFirestoreService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should reserve spot for general event with client', async () => {
    const dto = {
      eventId: 'event1',
      userId: 'user1',
      userType: UserType.CLIENT,
      spots: ['spot1'],
      ticket_kind: TicketKind.FULL,
      email: 'user@example.com',
    };

    const result = await service.reserveSpot(dto, '');

    expect(result).toEqual({
      spotId: 'spot1',
      ticketKind: 'full',
      email: 'user@example.com',
      eventId: 'event1',
      userId: 'user1',
    });
  });

  // it('should throw BadRequestException if user already has a reservation', async () => {
  //   hasUserReservation = true; // Configura para que o usuário tenha uma reserva

  //   const dto = {
  //     eventId: 'event1',
  //     userId: 'user1',
  //     userType: UserType.CLIENT,
  //     spots: ['spot1'],
  //     email: 'user@example.com',
  //     ticket_kind: TicketKind.FULL,
  //   };

  //   await expect(service.reserveSpot(dto)).rejects.toThrow(NotFoundException);
  // });

  // it('should handle case where event does not exist', async () => {
  //   const dto = {
  //     eventId: 'event1',
  //     userId: 'user1',
  //     userType: UserType.CLIENT,
  //     spots: ['spot1'],
  //     email: 'user@example.com',
  //     ticket_kind: TicketKind.FULL,
  //   };

  //   await expect(service.reserveSpot(dto)).rejects.toThrow(NotFoundException);
  // });

  // it('should throw BadRequestException if spots exceed the total limit', async () => {
  //   const dto = {
  //     eventId: 'event1',
  //     userId: 'user1',
  //     userType: UserType.CLIENT,
  //     spots: ['spot51'], // Supõe que o limite máximo é 50
  //     ticket_kind: TicketKind.FULL,
  //     email: 'user@example.com',
  //   };

  //   await expect(service.reserveSpot(dto)).rejects.toThrow(BadRequestException);
  // });
});
