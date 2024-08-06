import { BadRequestException, Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import { ChargeDto, CreatePaymentDto } from './dto/create-payment.dto';
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

  async payment(body: CreatePaymentDto): Promise<ChargeDto> {
    console.log('Dentro do provider pagarme');
    try {
      const response = await fetch('https://api.pagar.me/core/v5/orders', {
        method: 'post',
        headers: {
          Authorization: 'Bearer sk_test_36ad165ad80b4b819a0517d6b6d9c718',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body.paymentData),
      });

      console.log('fez o requesto no pagarme');
      const resp = await response.json();
      if (!response.ok) {
        console.log(resp);
        throw new Error(`PAGARME: ${response.statusText}`);
      } else {
        console.log('o resp pagarme existe nao é no pagarme');
        console.log(resp);
        let payLink: string = '';
        if (resp.charges[0].payment_method === 'credit_card') {
          payLink = resp.charges[0].last_transaction.acquirer_message;
        } else if (resp.charges[0].payment_method === 'boleto') {
          payLink = resp.charges[0].last_transaction.pdf;
        } else if (resp.charges[0].payment_method === 'pix') {
          payLink = resp.charges[0].last_transaction.qr_code;
        } else {
          throw new Error('Meio de pagamento não cadastrado');
        }

        let status: string = '';
        if (resp.status == 'paid') {
          status = 'Pago';
        } else if (resp.status == 'pending') {
          status = 'Processando';
        } else {
          status = resp.status;
        }

        const charge: ChargeDto = {
          event: resp.items[0].description,
          chargeId: resp.charges[0].id,
          status: status,
          amount: resp.items[0].amount,
          payLink: payLink,
          qrcodePix: resp.charges[0].last_transaction.qr_code_url ?? '',
          meio: resp.charges[0].payment_method,
          email: resp.customer.email,
          userID: '',
          lote: 0,
          envioWhatsapp: false,
        };

        const firestore = this.firestoreService.firestore;
        const reservationQuery = firestore
          .collection('reservationHistory')
          .where('email', '==', body.paymentData.customer.email)
          .where('eventId', '==', body.paymentData.items[0].title);

        try {
          const querySnapshot = await reservationQuery.get();

          const updatePromises = querySnapshot.docs.map(async (doc) => {
            const docData = doc.data();

            const updatedCharges = docData.charges || [];
            updatedCharges.push(charge);

            return doc.ref.update({
              charges: updatedCharges,
              status: status,
            });
          });

          await Promise.all(updatePromises);
        } catch (error) {
          console.error('Error updating charges:', error);
        }

        console.log('charge dados');
        return charge;
      }
    } catch (error) {
      throw new BadRequestException('CHAMA a ARIELA: ' + error);
    }
  }

  async handlePagarmeWebhook(body: any): Promise<void> {
    const firestore = this.firestoreService.firestore;
    const charge_data: any = body.data;

    if (charge_data.status === 'paid') {
      const reservationQuery = firestore
        .collection('reservationHistory')
        .where('email', '==', charge_data.customer.email);

      const querySnapshot = await reservationQuery.get();

      const updatePromises = querySnapshot.docs.map(async (doc) => {
        const docData = doc.data();

        if (Array.isArray(docData.charges)) {
          const chargeToUpdate = docData.charges.find(
            (charge: any) => charge.chargeId === charge_data.id,
          );

          if (chargeToUpdate) {
            return doc.ref.update({ status: 'paid' });
          }
        }

        return Promise.resolve();
      });

      await Promise.all(updatePromises);
    }
  }
}
