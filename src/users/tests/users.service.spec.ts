import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { FirestoreService } from '../../firebase/firebase.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { Gender, UserType } from '../dto/enum';
import { UpdateUserDto } from '../dto/update-user.dto';

// Mock do Firestore
const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  where: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  batch: jest.fn().mockReturnValue({
    commit: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }),
};

// Mock do FirestoreService
const mockFirestoreService = {
  firestore: mockFirestore,
  getFirestore: jest.fn().mockReturnValue(mockFirestore),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: FirestoreService,
          useValue: mockFirestoreService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should create a user successfully', async () => {
    const dto: CreateUserDto = {
      cpf: '12345678900',
      name: 'John Doe',
      email: 'test@test.com',
      userType: UserType.CLIENT,
      gender: Gender.MALE,
      address: 'a',
      complemento: 'a',
      cep: '37940000',
      cidade: 'a',
      estado: 'mg',
      ddd: '35',
      cellphone: '999999999',
      church: '',
      pastor: '',
      data_nasc: '',
      idade: 0,
      responsavel: '',
      documento_responsavel: '',
      ddd_responsavel: '',
      cellphone_responsavel: '',
      alergia: '',
      medicamento: '',
      info_add: ''
    };

    const mockWhere = jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({ empty: true }),
    });
    const mockDoc = jest.fn().mockReturnValue({
      id: 'newUserId',
      set: jest.fn().mockResolvedValue(undefined),
    });

    jest.spyOn(mockFirestore, 'collection').mockReturnValueOnce({
      where: mockWhere,
      doc: mockDoc,
    } as any);
    const result = await service.create(dto, '');
    expect(result).toEqual({ id: 'newUserId', ...dto });
    expect(mockFirestore.collection).toHaveBeenCalledWith('users');
    expect(mockWhere).toHaveBeenCalledWith('cpf', '==', dto.cpf);
  });

  it('should find all users', async () => {
    mockFirestore.get.mockResolvedValueOnce({
      docs: [
        { id: 'user1', data: () => ({ name: 'John Doe' }) },
        { id: 'user2', data: () => ({ name: 'Jane Doe' }) },
      ],
    } as any);

    const result = await service.findAll();

    expect(result).toEqual([
      { id: 'user1', name: 'John Doe' },
      { id: 'user2', name: 'Jane Doe' },
    ]);
  });

  it('should find one user by id', async () => {
    const userRef = {
      get: jest.fn().mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: 'John Doe' }),
      }),
    };

    mockFirestore.doc.mockReturnValueOnce(userRef as any);

    const result = await service.findOne('userId');

    expect(result).toEqual({ id: undefined, name: 'John Doe' });
  });

  it('should update a user successfully', async () => {
    const dto: UpdateUserDto = { name: 'Jane Doe' };
    const userRef = {
      update: jest.fn().mockResolvedValueOnce(undefined),
    };

    mockFirestore.doc.mockReturnValueOnce(userRef as any);

    const result = await service.update('userId', dto);

    expect(result).toEqual({ id: 'userId', ...dto });
    expect(userRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        ...dto,
        updatedAt: expect.any(String),
      }),
    );
  });

  it('should remove a user successfully', async () => {
    const userRef = {
      delete: jest.fn().mockResolvedValueOnce(undefined),
    };

    mockFirestore.doc.mockReturnValueOnce(userRef as any);

    const result = await service.remove('userId');

    expect(result).toEqual({ id: 'userId' });
    expect(userRef.delete).toHaveBeenCalled();
  });
});
