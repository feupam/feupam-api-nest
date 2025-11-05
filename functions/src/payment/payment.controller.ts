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
import { Public } from '../decorators/public.decorator';

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
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    const decoded = await this.authService.verifyToken(token);
    return this.paymentService.payment(body, decoded.email);
  }

  @Public()
  @Post('webhook-pagarme')
  async handlePagarmeWebhook(@Body() body: any) {
    return await this.paymentService.handlePagarmeWebhook(body);
  }

  // Reprocessa/consulta status diretamente na Pagar.me por chargeId (ou por email+eventId)
  @Post('reprocessar-status')
  async reprocessarStatus(@Body() body: any) {
    const { email, eventId, chargeId } = body || {};
    if (!email || !eventId) {
      throw new Error('Parâmetros obrigatórios: email e eventId');
    }
    return this.paymentService.reprocessPaymentStatus({ email, eventId, chargeId });
  }
}