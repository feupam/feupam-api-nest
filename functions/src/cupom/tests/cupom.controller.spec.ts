import { Test, TestingModule } from '@nestjs/testing';
import { CuponsController } from '../cupons.controller';
import { CuponsService } from '../cupons.service';

describe('CuponsController', () => {
  let controller: CuponsController;
  let service: CuponsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CuponsController],
      providers: [
        {
          provide: CuponsService,
          useValue: {
            createOrUpdateCoupon: jest.fn(),
            getCupons: jest.fn(),
            deleteCoupon: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CuponsController>(CuponsController);
    service = module.get<CuponsService>(CuponsService);
  });

  it('should create or update a coupon', async () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer mockToken', // Mocka o header de autenticação
      },
    };
    const result = [{ name: 'NEWCOUPON', discount: 0.2 }];
    jest.spyOn(service, 'createOrUpdateCoupon').mockResolvedValue(result);

    expect(
      await controller.createOrUpdateCoupon(
        'eventId',
        'newCoupon',
        0.2,
        mockRequest.headers.authorization,
      ),
    ).toEqual(result);
  });

  it('should get all cupons', async () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer mockToken', // Mocka o header de autenticação
      },
    };
    const result = [{ name: 'NEWCOUPON', discount: 0.2 }];
    jest.spyOn(service, 'getCupons').mockResolvedValue(result);

    expect(
      await controller.getCupons('eventId', mockRequest.headers.authorization),
    ).toEqual(result);
  });

  it('should delete a coupon', async () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer mockToken', // Mocka o header de autenticação
      },
    };
    const result = [];
    jest.spyOn(service, 'deleteCoupon').mockResolvedValue(result);

    expect(
      await controller.deleteCoupon(
        'eventId',
        'newCoupon',
        mockRequest.headers.authorization,
      ),
    ).toEqual(result);
  });
});
