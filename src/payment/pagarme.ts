import fetch from 'node-fetch';

export class Pagarme {
  public async createPayment(bodyPagarme: any): Promise<any> {
    const response = await fetch('https://api.pagar.me/core/v5/orders', {
      method: 'post',
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from('sk_test_9f212bc3e77b43c88b919dc0ca577c13:').toString(
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

      throw new Error(`message: ${resp.message}, fields: ${errorFieldsString}`);
    }
    return resp;
  }
}
