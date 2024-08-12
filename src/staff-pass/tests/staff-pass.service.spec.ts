import { Test, TestingModule } from '@nestjs/testing';
import { StaffPassService } from '../staff-pass.service';
import { FirestoreService } from '../../firebase/firebase.service';

// Mock do Firestore
const mockFirestoreCollection = {
  doc: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  add: jest.fn(),
};

const mockFirestore = {
  collection: jest.fn().mockImplementation((collectionName: string) => {
    if (collectionName === 'staffPasswords') {
      return mockFirestoreCollection;
    }
    return {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    };
  }),
};

const mockFirestoreService = {
  firestore: mockFirestore,
  getFirestore: jest.fn().mockReturnValue(mockFirestore),
};

describe('StaffPassService', () => {
  let service: StaffPassService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffPassService,
        {
          provide: FirestoreService,
          useValue: mockFirestoreService,
        },
      ],
    }).compile();

    service = module.get<StaffPassService>(StaffPassService);
  });

  it('should create a staff pass successfully', async () => {
    const eventId = 'event1';
    const staff_pass = '1234';

    mockFirestoreCollection.add = jest
      .fn()
      .mockResolvedValueOnce({ id: 'newId' });
    mockFirestoreCollection.get = jest
      .fn()
      .mockResolvedValueOnce({ empty: true, docs: [] });

    const result = await service.create(eventId, staff_pass);

    expect(result).toEqual([{ eventId, staff_pass }]);
    expect(mockFirestore.collection).toHaveBeenCalledWith('staffPasswords');
  });

  it('should update a staff pass successfully', async () => {
    const eventId = 'event1';
    const staff_pass = '5678';

    mockFirestoreCollection.where = jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: [{ ref: { update: jest.fn() } }],
      }),
    });

    const result = await service.update(eventId, staff_pass);

    expect(result).toEqual([{ eventId, staff_pass }]);
    expect(mockFirestoreCollection.update).toHaveBeenCalledWith({ staff_pass });
  });

  it('should remove a staff pass successfully', async () => {
    const eventId = 'event1';

    mockFirestoreCollection.where = jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValueOnce({
        empty: false,
        docs: [{ ref: { delete: jest.fn() } }],
      }),
    });

    const result = await service.remove(eventId);

    expect(result).toEqual([]);
    expect(mockFirestoreCollection.delete).toHaveBeenCalled();
  });

  it('should read a staff pass and return true if correct', async () => {
    const eventId = 'event1';
    const staff_pass = '1234';

    mockFirestoreCollection.where = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({
          empty: false,
          docs: [{ data: jest.fn().mockReturnValue({ staff_pass }) }],
        }),
      }),
    });

    const result = await service.read(eventId, staff_pass);

    expect(result).toBe(true);
  });

  it('should read a staff pass and return false if incorrect', async () => {
    const eventId = 'event1';
    const staff_pass = 'wrong_pass';

    mockFirestoreCollection.where = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValueOnce({
          empty: false,
          docs: [
            { data: jest.fn().mockReturnValue({ staff_pass: 'correct_pass' }) },
          ],
        }),
      }),
    });

    const result = await service.read(eventId, staff_pass);

    expect(result).toBe(false);
  });
});
