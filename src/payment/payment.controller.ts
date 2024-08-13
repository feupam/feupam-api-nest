import {
  Controller,
  Post,
  Body,
  Headers,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { AuthService } from '../firebase/auth.service';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async payment(
    @Body() body: any,
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.paymentService.payment(body);
  }

  @Post('webhook-pagarme')
  async handlePagarmeWebhook(@Body() body: any) {
    return await this.paymentService.handlePagarmeWebhook(body);
  }
}
