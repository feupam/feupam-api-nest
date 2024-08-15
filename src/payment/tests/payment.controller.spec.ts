import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from '../payment.controller';
import { PaymentService } from '../payment.service';
import { ChargeDto } from '../dto/create-payment.dto';

describe('PaymentController', () => {
  let controller: PaymentController;

  const mockPaymentService = {
    payment: jest.fn().mockResolvedValue({
      items: [{ amount: 2990, description: 'federa' }],
      customer: { email: 'ariela.stefanini@sou.unifal-mg.edu.br' },
      payments: {
        payment_method: 'credit_card',
        credit_card: {
          installments: 1,
          statement_descriptor: 'AVENGERS',
          card: {
            number: '4000000000000010',
            holder_name: 'Tony Stark',
            exp_month: 1,
            exp_year: 30,
            cvv: '3531',
            billing_address: {
              line_1: '10880, Malibu Point, Malibu Central',
              zip_code: '90265',
              city: 'Malibu',
              state: 'CA',
              country: 'US',
            },
          },
        },
      },
    }),
    handlePagarmeWebhook: jest.fn().mockResolvedValue({
      id: 'hook_nVNwZ28uAu3WqLEO',
      account: {
        id: 'acc_8dnw5PzCoSJWmZrg',
        name: 'PRESBITERIO VALE DO RIO GRANDE - test',
      },
      type: 'charge.paid',
      created_at: '2024-04-09T16:56:01.8782162Z',
      data: {
        id: 'ch_9wn2KB8CxC4zxDod',
        status: 'paid',
        customer: {
          id: 'cus_qgBk15ztlXSoZkeG',
          name: 'Ariela Stefanini',
          email: 'ariela.stefanini@sou.unifal-mg.edu.br',
        },
        last_transaction: {
          transaction_type: 'pix',
          amount: 33000,
          status: 'paid',
          success: true,
          created_at: '2024-04-09T16:52:18.5260834Z',
          updated_at: '2024-04-09T16:52:18.5260834Z',
        },
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('payment', () => {
    it('should return the result from paymentService.payment', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer mockToken', // Mocka o header de autenticação
        },
      };
      const body = {
        items: [
          {
            amount: 2990,
            description: 'federa',
          },
        ],
        customer: {
          email: 'ariela.stefanini@sou.unifal-mg.edu.br',
        },
        payments: {
          payment_method: 'credit_card',
          credit_card: {
            card: {
              billing_address: {
                city: 'Malibu',
                country: 'US',
                line_1: '10880, Malibu Point, Malibu Central',
                state: 'CA',
                zip_code: '90265',
              },
              cvv: '3531',
              exp_month: 1,
              exp_year: 30,
              holder_name: 'Tony Stark',
              number: '4000000000000010',
            },
            installments: 1,
            statement_descriptor: 'AVENGERS',
          },
        },
      };
      const resp: ChargeDto = {
        event: 'federa',
        status: 'Pago',
        amount: 30000,
        payLink: 'payLink',
        qrcodePix: 'response.charges[0].last_transaction.qr_code_url',
        meio: 'pix',
        email: 'ariela.stefanini@sou.unifal-mg.edu.br',
        lote: 0,
        envioWhatsapp: false,
        chargeId: ''
      };

      const paymentServiceMock = {
        payment: jest.fn().mockResolvedValue(resp),
      };

      const result = await controller.payment(
        body,
        mockRequest.headers.authorization,
      );
      expect(result).toEqual(resp);
      expect(paymentServiceMock.payment).toHaveBeenCalledWith(body);
    });
  });

  describe('handlePagarmeWebhook', () => {
    it('should return the result from paymentService.handlePagarmeWebhook', async () => {
      const body_webhook = { webhook_body: 'test' };
      const paymentServiceMock = {
        handlePagarmeWebhook: jest.fn().mockResolvedValue({ message: 'ok' }),
      };

      const result1 = await controller.handlePagarmeWebhook(body_webhook);
      expect(paymentServiceMock.handlePagarmeWebhook).toHaveBeenCalledWith(
        body_webhook,
      );
      expect(result1).toEqual({ message: 'ok' });
    });
  });
});
