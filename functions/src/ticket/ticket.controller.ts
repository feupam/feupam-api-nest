import {
  Controller,
  Get,
  Param,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { AuthService } from '../firebase/auth.service';

@Controller('tickets')
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly authService: AuthService
  ) {}

  @Get(':id/purchase')
  async purchase(
    @Param('id') id: string,
    @Headers('Authorization') authHeader: string,
  ) {
    try {
      const token = authHeader?.split(' ')[1];
      const decoded = await this.authService.verifyToken(token);
      const result = await this.ticketService.purchaseTicket(id, decoded.email);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado';
      throw new HttpException(
        { status: 'error', message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id/retry')
  async retry(
    @Param('id') id: string,
    @Headers('Authorization') authHeader: string,
  ) {
    try {
      const token = authHeader?.split(' ')[1];
      const decoded = await this.authService.verifyToken(token);
      const result = await this.ticketService.getReservationStatus(id, decoded.email);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado';
      throw new HttpException(
        { status: 'error', message },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}