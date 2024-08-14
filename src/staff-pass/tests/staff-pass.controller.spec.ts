import { Test, TestingModule } from '@nestjs/testing';
import { StaffPassController } from '../staff-pass.controller';
import { StaffPassService } from '../staff-pass.service';

describe('StaffPassController', () => {
  let controller: StaffPassController;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars

  const mockStaffPassService = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    read: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffPassController],
      providers: [
        {
          provide: StaffPassService,
          useValue: mockStaffPassService,
        },
      ],
    }).compile();

    controller = module.get<StaffPassController>(StaffPassController);
  });

  it('should create a staff pass', async () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer mockToken', // Mocka o header de autenticação
      },
    };
    const eventId = 'event1';
    const body = { staff_pass: '1234' };
    const result = [{ eventId, staff_pass: '1234' }];
    mockStaffPassService.create.mockResolvedValue(result);

    expect(
      await controller.create(eventId, body, mockRequest.headers.authorization),
    ).toBe(result);
    expect(mockStaffPassService.create).toHaveBeenCalledWith(
      eventId,
      body.staff_pass,
    );
  });

  it('should update a staff pass', async () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer mockToken', // Mocka o header de autenticação
      },
    };
    const eventId = 'event1';
    const body = { staff_pass: '5678' };
    const result = [{ eventId, staff_pass: '5678' }];
    mockStaffPassService.update.mockResolvedValue(result);

    expect(
      await controller.update(eventId, body, mockRequest.headers.authorization),
    ).toBe(result);
    expect(mockStaffPassService.update).toHaveBeenCalledWith(
      eventId,
      body.staff_pass,
    );
  });

  it('should remove a staff pass', async () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer mockToken', // Mocka o header de autenticação
      },
    };
    const eventId = 'event1';
    const result = [];
    mockStaffPassService.remove.mockResolvedValue(result);

    expect(
      await controller.remove(eventId, mockRequest.headers.authorization),
    ).toBe(result);
    expect(mockStaffPassService.remove).toHaveBeenCalledWith(eventId);
  });

  it('should read a staff pass and return true if correct', async () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer mockToken', // Mocka o header de autenticação
      },
    };
    const eventId = 'event1';
    const body = { staff_pass: '1234' };
    mockStaffPassService.read.mockResolvedValue(true);

    expect(
      await controller.read(eventId, body, mockRequest.headers.authorization),
    ).toBe(true);
    expect(mockStaffPassService.read).toHaveBeenCalledWith(
      eventId,
      body.staff_pass,
    );
  });

  it('should read a staff pass and return false if incorrect', async () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer mockToken', // Mocka o header de autenticação
      },
    };

    const eventId = 'event1';
    const body = { staff_pass: 'wrong_pass' };
    mockStaffPassService.read.mockResolvedValue(false);

    expect(
      await controller.read(eventId, body, mockRequest.headers.authorization),
    ).toBe(false);
    expect(mockStaffPassService.read).toHaveBeenCalledWith(
      eventId,
      body.staff_pass,
    );
  });
});
