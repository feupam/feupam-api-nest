import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from '../payment.service';
import { FirestoreService } from '../../firebase/firebase.service';
import { Pagarme } from '../pagarme';
import { ConfigService } from '@nestjs/config';
import { Queries } from '../queries';

describe('PaymentService', () => {
  let service: PaymentService;
  let mockFirestore: any;
  let mockPaymentDoc: any;
  let mockPaymentHistoryDocs: any;
  let mockUserDoc: any;
  let queries: Queries;
  let pagarme: Pagarme;

  beforeEach(async () => {
    // Mock dos documentos de pagamento
    mockPaymentDoc = {
      exists: true,
      data: jest.fn().mockReturnValue({
        paymentId: 'payment1',
        amount: 100,
        status: 'completed',
        userId: 'user1',
        eventId: 'event1',
      }),
    };

    // Mock dos documentos de histórico de pagamento
    mockPaymentHistoryDocs = [
      {
        id: 'paymentHistory1',
        data: jest.fn().mockReturnValue({
          paymentId: 'payment1',
          userId: 'user1',
          amount: 100,
        }),
      },
    ];

    // Mock do documento de usuário
    mockUserDoc = [
      {
        exists: true,
        data: jest.fn().mockReturnValue({
          userId: 'user1',
          email: 'user@example.com',
        }),
      },
    ];

    // Mock do Firestore para todas as coleções
    mockFirestore = {
      collection: jest.fn().mockImplementation((collectionName: string) => {
        if (collectionName === 'payments') {
          return {
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(mockPaymentDoc),
              set: jest.fn().mockResolvedValue(undefined), // Mock para `set()`
            }),
          };
        } else if (collectionName === 'paymentHistory') {
          return {
            where: jest
              .fn()
              .mockImplementation(
                (field: string, operator: string, value: any) => {
                  if (
                    field === 'paymentId' &&
                    operator === '==' &&
                    value === 'payment1'
                  ) {
                    return {
                      get: jest.fn().mockResolvedValue({
                        empty: mockPaymentHistoryDocs.length === 0,
                        docs: mockPaymentHistoryDocs,
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
        } else if (collectionName === 'users') {
          return {
            where: jest.fn().mockImplementation(() => {
              return {
                get: jest.fn().mockResolvedValue({
                  empty: mockUserDoc.length === 0,
                  docs: mockUserDoc,
                  forEach: (callback: (doc: any) => void) =>
                    mockUserDoc.forEach(callback),
                }),
              };
            }),
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(mockUserDoc),
            }),
          };
        } else if (collectionName === 'reservationHistory') {
          return {
            where: jest.fn().mockImplementation(() => {
              return {
                get: jest.fn().mockResolvedValue({
                  empty: mockUserDoc.length === 0,
                  docs: mockUserDoc,
                  forEach: (callback: (doc: any) => void) =>
                    mockUserDoc.forEach(callback),
                }),
              };
            }),
            doc: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(mockUserDoc),
            }),
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

    // Mock ConfigService
    const mockConfigService = {
      get: jest.fn().mockReturnValue('some-config-value'),
    };

    const mockFirestoreService = {
      firestore: mockFirestore,
      getFirestore: jest.fn().mockReturnValue(mockFirestore),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: FirestoreService,
          useValue: mockFirestoreService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: Queries,
          useValue: {
            getUserByEmail: jest.fn(),
            getReservationByEmailAndEvent: jest.fn(),
            updateReservationStatus: jest.fn(),
          },
        },
        {
          provide: Pagarme,
          useValue: {
            createPayment: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    queries = module.get<Queries>(Queries);
    pagarme = module.get<Pagarme>(Pagarme);
  });

  it('should process payment successfully', async () => {
    const req = {
      items: [
        {
          amount: 2990,
          description: 'federa',
        },
      ],
      customer: {
        email: 'user@example.com',
      },
      payments: {
        payment_method: 'pix',
      },
    };

    const bodyPagarme = {
      closed: true,
      customer: {
        name: 'ariela',
        type: 'individual',
        email: 'user@example.com',
        document: '01125445223',
        address: {
          line_1: 'a',
          line_2: 'b',
          zip_code: '37940000',
          city: 'user.cidade',
          state: 'user.estado',
          country: 'BR',
        },
        phones: {
          mobile_phone: {
            country_code: '55',
            area_code: '35',
            number: '998185335',
          },
        },
      },
      items: [
        {
          amount: 2990,
          description: 'federa',
          quantity: 1,
          code: 123,
        },
      ],
      payments: [
        {
          payment_method: 'pix',
          pix: {
            expires_in: '7200',
          },
        },
      ],
    };

    const response = {
      event: 'federa',
      chargeId: '1',
      status: 'Pago',
      amount: 30000,
      payLink: 'payLink',
      qrcodePix: 'response.charges[0].last_transaction.qr_code_url',
      meio: 'pix',
      email: 'ariela.stefanini@sou.unifal-mg.edu.br',
      userID: '1',
      lote: 0,
      envioWhatsapp: false,
    };

    jest.spyOn(queries, 'getUserByEmail').mockResolvedValue('user@example.com');
    jest.spyOn(service, 'buildRequestBody').mockReturnValue(bodyPagarme);
    jest.spyOn(queries, 'getReservationByEmailAndEvent').mockResolvedValue([]);
    jest.spyOn(pagarme, 'createPayment').mockResolvedValue(response);
    jest.spyOn(queries, 'updateReservationStatus').mockResolvedValue();

    const result = await service.payment(req);
    expect(result).toEqual(response);
  });

  // Adicione outros testes conforme necessário
});
