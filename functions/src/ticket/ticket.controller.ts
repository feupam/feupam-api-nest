import { Controller, Post, Param, Body } from '@nestjs/common';
import { TicketService } from './ticket.service';

@Controller('tickets')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  // POST /tickets/:id/purchase?email=fulano@email.com
  @Post(':id/purchase')
  async purchase(@Param('id') id: string, @Body('email') email: string): Promise<any> {
    return this.ticketService.purchaseTicket(id, email);
  }
}


