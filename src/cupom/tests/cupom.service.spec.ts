import { Test, TestingModule } from '@nestjs/testing';
import { CuponsService } from '../cupons.service';
import { FirestoreService } from '../../firebase/firebase.service';

const mockFirestore = {
  collection: jest.fn().mockImplementation((collectionName: string) => {
    if (collectionName === 'events') {
      return {
        doc: jest.fn().mockImplementation(() => {
          return {
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: jest.fn().mockReturnValue({
                cupons: [],
              }),
            }),
            update: jest.fn(),
          };
        }),
      };
    }
    return {
      doc: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: jest.fn().mockReturnValue({}),
      }),
      update: jest.fn(),
    };
  }),
};

describe('CuponsService', () => {
  let service: CuponsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CuponsService,
        {
          provide: FirestoreService,
          useValue: { firestore: mockFirestore },
        },
      ],
    }).compile();

    service = module.get<CuponsService>(CuponsService);
  });

  it('should create or update a coupon', async () => {
    const result = await service.createOrUpdateCoupon(
      'eventId',
      'newCoupon',
      0.2,
    );
    expect(result).toEqual([{ name: 'NEWCOUPON', discount: 0.2 }]);
  });

  it('should get all cupons', async () => {
    mockFirestore
      .collection()
      .doc()
      .get.mockResolvedValueOnce({
        exists: true,
        data: jest.fn().mockReturnValue({
          cupons: [{ name: 'NEWCOUPON', discount: 0.2 }],
        }),
      });

    const result = await service.getCupons('eventId');
    expect(result).toEqual([{ name: 'NEWCOUPON', discount: 0.2 }]);
  });

  it('should delete a coupon', async () => {
    mockFirestore
      .collection()
      .doc()
      .get.mockResolvedValueOnce({
        exists: true,
        data: jest.fn().mockReturnValue({
          cupons: [{ name: 'NEWCOUPON', discount: 0.2 }],
        }),
      });

    const result = await service.deleteCoupon('eventId', 'newCoupon');
    expect(result).toEqual([]);
  });
});
