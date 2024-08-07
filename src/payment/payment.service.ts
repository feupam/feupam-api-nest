import { BadRequestException, Injectable } from '@nestjs/common';
import { ChargeDto } from './dto/create-payment.dto';
import { Queries } from './queries';
import { Pagarme } from './pagarme';
import { BuildBody } from './build-body';
import { FirestoreService } from 'src/firebase/firebase.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentService {
  private readonly key: string;

  constructor(
    private readonly firestoreService: FirestoreService,
    private readonly configService: ConfigService,
  ) {
    this.key =
      this.configService.get<string>('TEST_PRIVATE_KEY') ?? 'n tem chave';
  }

  async payment(req: any): Promise<ChargeDto> {
    try {
      const queriesService = new Queries(this.firestoreService);
      const pagarmeService = new Pagarme();
      const user = await queriesService.getUserByEmail(req.customer.email);
      const bodyPagarme = this.buildRequestBody(req, user[0]);
      const existingReservation =
        await queriesService.getReservationByEmailAndEvent(
          bodyPagarme.customer.email,
          bodyPagarme.items[0].description,
        );

      if (
        existingReservation[0]?.eventId === bodyPagarme.items[0].description &&
        existingReservation[0]?.status === 'Pago'
      ) {
        return { message: 'usuario ja comprou' } as any;
      }

      const response = await pagarmeService.createPayment(bodyPagarme);
      const charge = this.buildChargeDto(response);
      await queriesService.updateReservationStatus(
        bodyPagarme.customer.email,
        bodyPagarme.items[0].description,
        charge,
        charge.status,
      );

      return charge;
    } catch (error) {
      throw new BadRequestException(`Pagarme: ${error}`);
    }
  }

  private buildRequestBody(req: any, user: any): any {
    const buildBody = new BuildBody();
    switch (req.payments.payment_method) {
      case 'credit_card':
        return buildBody.creditBody(req, user);
      case 'boleto':
        return buildBody.boletoBody(req, user);
      case 'pix':
        return buildBody.pixBody(req, user);
      default:
        throw new Error('Tipo de pagamento não cadastrado');
    }
  }

  private buildChargeDto(response: any): ChargeDto {
    const payLink = this.getPayLink(response.charges[0]);
    const status = this.getStatus(response.status);

    return {
      event: response.items[0].description,
      chargeId: response.charges[0].id,
      status: status,
      amount: response.items[0].amount,
      payLink: payLink,
      qrcodePix: response.charges[0].last_transaction.qr_code_url ?? '',
      meio: response.charges[0].payment_method,
      email: response.customer.email,
      userID: '',
      lote: 0,
      envioWhatsapp: false,
    };
  }

  private getPayLink(charge: any): string {
    switch (charge.payment_method) {
      case 'credit_card':
        return charge.last_transaction.acquirer_message;
      case 'boleto':
        return charge.last_transaction.pdf;
      case 'pix':
        return charge.last_transaction.qr_code;
      default:
        throw new Error('Meio de pagamento não cadastrado');
    }
  }

  private getStatus(status: string): string {
    switch (status) {
      case 'paid':
        return 'Pago';
      case 'pending':
        return 'Processando';
      default:
        return status;
    }
  }

  async handlePagarmeWebhook(body: any): Promise<void> {
    const queriesService = new Queries(this.firestoreService);

    const chargeData = body.data;

    if (chargeData.status === 'paid') {
      await queriesService.updateChargeStatus(
        chargeData.customer.email,
        chargeData.id,
        'Pago',
      );
    }
  }
}
