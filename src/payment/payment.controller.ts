import { Controller, Post, Body } from '@nestjs/common';
import { PaymentService } from './payment.service';
//import { AuthService } from 'src/firebase/auth.service';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    //private readonly authService: AuthService,
  ) {}

  @Post()
  async payment(
    @Body() body: any,
    //@Headers('authorization') authHeader: string,
  ) {
    //const token = authHeader?.split(' ')[1];
    //await this.authService.verifyToken(token);
    const { paymentData } = body;
    return this.paymentService.payment(paymentData);
  }

  @Post('webhook-pagarme')
  async handlePagarmeWebhook(@Body() body: any) {
    await this.paymentService.handlePagarmeWebhook(body);
  }
}
