import { Controller, Get, Param, Headers } from '@nestjs/common';
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
      const token = authHeader?.split(' ')[1];
      const decoded = await this.authService.verifyToken(token);
      return this.ticketService.purchaseTicket(id, decoded.email);
  }
}


