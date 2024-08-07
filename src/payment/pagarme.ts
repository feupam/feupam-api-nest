import fetch from 'node-fetch';

export class Pagarme {
  async createPayment(bodyPagarme: any): Promise<any> {
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

      throw new Error(`message: ${resp.message}, fields: ${errorFieldsString}`);
    }
    return resp;
  }
}
