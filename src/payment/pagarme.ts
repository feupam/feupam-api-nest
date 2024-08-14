import fetch from 'node-fetch';
import * as functions from 'firebase-functions';


export class Pagarme {
  public async createPayment(bodyPagarme: any): Promise<any> {
    const key = functions.config().config.pagarme_key;

    const response = await fetch('https://api.pagar.me/core/v5/orders', {
      method: 'post',
      headers: {
        Authorization: 'Basic ' + Buffer.from(key).toString('base64'),
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

      throw new Error(`message: ${resp.message}, fields: ${errorFieldsString}`);
    }
    return resp;
  }
}
