import fetch from 'node-fetch';


export class Pagarme {
  public async createPayment(bodyPagarme: any): Promise<any> {

    const key = "sk_test_b2ebe5160d2a40c093b0dfe93f7f090e:";
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

  public async getCharge(chargeId: string): Promise<any> {
    const key = "sk_test_b2ebe5160d2a40c093b0dfe93f7f090e:";
    const url = `https://api.pagar.me/core/v5/charges/${encodeURIComponent(chargeId)}`;

    const response = await fetch(url, {
      method: 'get',
      headers: {
        Authorization: 'Basic ' + Buffer.from(key).toString('base64'),
        'Content-Type': 'application/json',
      },
    });

    const resp = await response.json();
    if (response.status !== 200) {
      const message = resp?.message || 'Erro ao consultar charge';
      throw new Error(`message: ${message}`);
    }
    return resp;
  }
}
