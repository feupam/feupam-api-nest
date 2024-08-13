import { BadRequestException, Injectable } from '@nestjs/common';
import { ChargeDto } from './dto/create-payment.dto';
import { Queries } from './queries';
import { Pagarme } from './pagarme';
import { BuildBody } from './build-body';
import { FirestoreService } from '../firebase/firebase.service';

@Injectable()
export class PaymentService {
  constructor(private readonly firestoreService: FirestoreService) {}

  async payment(req: any, email: string): Promise<ChargeDto> {
    try {
      const queriesService = new Queries(this.firestoreService);
      const pagarmeService = new Pagarme();
      const user = await queriesService.getUserByEmail(email);
      const bodyPagarme = this.buildRequestBody(req, user[0]);

      const existingReservation =
        await queriesService.getReservationByEmailAndEvent(
          email,
          bodyPagarme.items[0].description,
        );

      if (
        existingReservation[0]?.eventId === bodyPagarme.items[0].description &&
        existingReservation[0]?.status === 'Pago'
      ) {
        throw new Error('usuario ja comprou');
      }

      const reservationQuery = this.firestoreService.firestore
        .collection('reservationHistory')
        .where('email', '==', email)
        .where('eventId', '==', bodyPagarme.items[0].description);
      const queryReservation = await reservationQuery.get();
      if (queryReservation.empty) {
        throw new Error('Você nao possui reserva para esse evento');
      }

      const response = await pagarmeService.createPayment(bodyPagarme);
      let payLink: string = '';
      if (response.charges[0].payment_method === 'credit_card') {
        payLink = response.charges[0].last_transaction.acquirer_message;
      } else if (response.charges[0].payment_method === 'boleto') {
        payLink = response.charges[0].last_transaction.pdf;
      } else if (response.charges[0].payment_method === 'pix') {
        payLink = response.charges[0].last_transaction.qr_code;
      } else {
        throw new Error('Meio de pagamento não cadastrado');
      }

      let status: string = '';
      if (response.status == 'paid') {
        status = 'Pago';
      } else if (response.status == 'pending') {
        status = 'Processando';
      } else {
        status = response.status;
      }
      console.log(response);
      const charge: ChargeDto = {
        event: response.items[0].description,
        status: status,
        amount: response.items[0].amount,
        payLink: payLink,
        qrcodePix: response.charges[0].last_transaction.qr_code_url ?? '',
        meio: response.charges[0].payment_method,
        email: response.customer.email,
        lote: 0,
        envioWhatsapp: false,
        chargeId: response.charges[0].id,
      };

      await queriesService.updateReservationStatus(
        charge,
        status,
        queryReservation,
      );

      return charge;
    } catch (error) {
      throw new BadRequestException(`Pagarme: ${error}`);
    }
  }

  public buildRequestBody(req: any, user: any): any {
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

  public getPayLink(charge: any): string {
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

  public getStatus(status: string): string {
    switch (status) {
      case 'paid':
        return 'Pago';
      case 'pending':
        return 'Processando';
      default:
        return status;
    }
  }

  async handlePagarmeWebhook(body: any) {
    const queriesService = new Queries(this.firestoreService);

    const webhookData = body.data;

    if (webhookData.status === 'paid') {
      await queriesService.updateChargeStatus(
        webhookData.customer.email,
        webhookData.id,
        'Pago',
      );
    }
    return { message: 'ok' };
  }
}
