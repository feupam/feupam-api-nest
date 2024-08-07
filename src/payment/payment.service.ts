import { BadRequestException, Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import { ChargeDto } from './dto/create-payment.dto';
import { FirestoreService } from 'src/firebase/firebase.service';
import { ConfigService } from '@nestjs/config';
import { BuildBody } from './build-body';

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

  async payment(req: any) {
    try {
      const user: any = [];
      const firestore = this.firestoreService.firestore;
      const userQuery = firestore
        .collection('users')
        .where('email', '==', req.customer.email);

      const queryUser = await userQuery.get();
      queryUser.forEach((doc) => user.push(doc.data()));

      const b = new BuildBody();
      let bodyPagarme;
      if (req.payments.payment_method === 'credit_card') {
        bodyPagarme = b.creditBody(req, user[0]);
      } else if (req.payments.payment_method === 'boleto') {
        bodyPagarme = b.boletoBody(req, user[0]);
      } else if (req.payments.payment_method === 'pix') {
        bodyPagarme = b.pixBody(req, user[0]);
      } else {
        throw new Error('Tipo de pagamento não cadastrado');
      }

      const hist: any = [];
      const reservationQuery = firestore
        .collection('reservationHistory')
        .where('email', '==', bodyPagarme.customer.email)
        .where('eventId', '==', bodyPagarme.items[0].description);

      const querySnapshot = await reservationQuery.get();
      querySnapshot.forEach((doc) => hist.push(doc.data()));

      if (
        hist[0].eventId === bodyPagarme.items[0].description &&
        hist[0].status === 'Pago'
      ) {
        return { message: 'usuario ja comprou' };
      }

      const response = await fetch('https://api.pagar.me/core/v5/orders', {
        method: 'post',
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from('sk_test_36ad165ad80b4b819a0517d6b6d9c718:').toString(
              'base64',
            ),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPagarme),
      });
      const resp = await response.json();

      if (response.status !== 200) {
        const errorFields = Object.keys(resp.errors).map((key) => ({
          field: key,
        }));

        const errorFieldsString = errorFields
          .map((error) => error.field)
          .join(', ');

        throw new Error(
          `message: ${resp.message}, fields: ${errorFieldsString}`,
        );
      } else {
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

        return charge;
      }
    } catch (error) {
      throw new BadRequestException(`Pagarme: ${error}`);
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
          const chargeIndex = docData.charges.findIndex(
            (charge: any) => charge.chargeId === charge_data.id,
          );

          if (chargeIndex !== -1) {
            docData.charges[chargeIndex].status = 'Pago';

            await doc.ref.update({
              status: 'Pago',
              charges: docData.charges,
            });

            return;
          }
        }
      });

      await Promise.all(updatePromises);
    }
  }
}
