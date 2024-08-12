import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { Gender, UserType } from '../dto/enum';

describe('UsersController', () => {
  let controller: UsersController;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let service: UsersService;

  const mockUsersService = {
    create: jest.fn((dto) => Promise.resolve({ id: '1', ...dto })),
    findAll: jest.fn(() => Promise.resolve([{ id: '1', name: 'Test User' }])),
    findOne: jest.fn((id) => Promise.resolve({ id, name: 'Test User' })),
    update: jest.fn((id, dto) => Promise.resolve({ id, ...dto })),
    remove: jest.fn((id) => Promise.resolve({ id })),
    getUserReservations: jest.fn((userId) =>
      Promise.resolve([{ id: '1', userId }]),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a user', async () => {
      const dto: CreateUserDto = {
        name: 'Test User',
        email: '',
        cpf: '',
        userType: UserType.CLIENT,
        gender: Gender.MALE,
        address: undefined,
        complemento: undefined,
        cep: undefined,
        cidade: undefined,
        estado: undefined,
        ddd: undefined,
        cellphone: undefined,
      };
      expect(await controller.create(dto)).toEqual({ id: '1', ...dto });
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      expect(await controller.findAll()).toEqual([
        { id: '1', name: 'Test User' },
      ]);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      expect(await controller.findOne('1')).toEqual({
        id: '1',
        name: 'Test User',
      });
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const dto: UpdateUserDto = { name: 'Updated User' };
      expect(await controller.update('1', dto)).toEqual({ id: '1', ...dto });
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      expect(await controller.remove('1')).toEqual({ id: '1' });
    });
  });

  describe('getUserReservations', () => {
    it('should return reservations for a user', async () => {
      expect(await controller.getUserReservations()).toEqual([
        { id: '1', userId: '1' },
      ]);
    });
  });
});
