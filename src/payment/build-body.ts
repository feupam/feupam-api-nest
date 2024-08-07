import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { ReqPaymentDto } from './dto/req-payment.dto';
import { BadRequestException } from '@nestjs/common';

export class BuildBody {
  public creditBody(data: ReqPaymentDto, user: CreateUserDto) {
    try {
      const pagarme = {
        closed: true,
        customer: {
          name: user.name,
          type: 'individual',
          email: user.email,
          document: user.cpf,
          address: {
            line_1: user.address,
            line_2: user.complemento,
            zip_code: user.cep,
            city: user.cidade,
            state: user.estado,
            country: 'BR',
          },
          phones: {
            mobile_phone: {
              country_code: '55',
              area_code: user.ddd,
              number: user.cellphone,
            },
          },
        },
        items: [
          {
            amount: data.items[0].amount,
            description: data.items[0].description,
            quantity: 1,
            code: 123,
          },
        ],
        payments: [
          {
            payment_method: data.payments.payment_method,
            credit_card: {
              recurrence: false,
              installments: data.payments.credit_card?.installments,
              statement_descriptor:
                data.payments.credit_card?.statement_descriptor,
              card: {
                auth_and_capture: true,
                captured: true,
                number: data.payments.credit_card?.card.number,
                holder_name: data.payments.credit_card?.card.holder_name,
                exp_month: data.payments.credit_card?.card.exp_month,
                exp_year: data.payments.credit_card?.card.exp_year,
                cvv: data.payments.credit_card?.card.cvv,
                billing_address: {
                  line_1: user.address,
                  line_2: user.complemento,
                  zip_code: user.cep,
                  city: user.cidade,
                  state: user.estado,
                  country: 'BR',
                },
              },
            },
          },
        ],
      };

      return pagarme;
    } catch (error) {
      throw new BadRequestException(`Body: ${error}`);
    }
  }

  public boletoBody(data: ReqPaymentDto, user: CreateUserDto) {
    try {
      const pagarme = {
        closed: true,
        customer: {
          name: user.name,
          type: 'individual',
          email: user.email,
          document: user.cpf,
          address: {
            line_1: user.address,
            line_2: user.complemento,
            zip_code: user.cep,
            city: user.cidade,
            state: user.estado,
            country: 'BR',
          },
          phones: {
            mobile_phone: {
              country_code: '55',
              area_code: user.ddd,
              number: user.cellphone,
            },
          },
        },
        items: [
          {
            amount: data.items[0].amount,
            description: data.items[0].description,
            quantity: 1,
            code: 123,
          },
        ],
        payments: [
          {
            payment_method: data.payments.payment_method,
            boleto: {
              instructions:
                'Este boleto não tem validade. Porém só será contabilizado a sua compra depois do pagamento',
              due_at: data.payments.boleto?.due_at,
              document_number: '123',
              type: 'DM',
            },
          },
        ],
      };
      return pagarme;
    } catch (error) {
      throw new BadRequestException(`Body: ${error}`);
    }
  }

  public pixBody(data: ReqPaymentDto, user: CreateUserDto) {
    try {
      const pagarme = {
        closed: true,
        customer: {
          name: user.name,
          type: 'individual',
          email: user.email,
          document: user.cpf,
          address: {
            line_1: user.address,
            line_2: user.complemento,
            zip_code: user.cep,
            city: user.cidade,
            state: user.estado,
            country: 'BR',
          },
          phones: {
            mobile_phone: {
              country_code: '55',
              area_code: user.ddd,
              number: user.cellphone,
            },
          },
        },
        items: [
          {
            amount: data.items[0].amount,
            description: data.items[0].description,
            quantity: 1,
            code: 123,
          },
        ],
        payments: [
          {
            payment_method: data.payments.payment_method,
            pix: {
              expires_in: '7200',
            },
          },
        ],
      };
      return pagarme;
    } catch (error) {
      throw new BadRequestException(`Body: ${error}`);
    }
  }
}
