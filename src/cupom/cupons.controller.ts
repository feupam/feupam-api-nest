import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { CuponsService } from './cupons.service';

@Controller('cupons')
export class CuponsController {
  constructor(private readonly cuponsService: CuponsService) {}

  @Post(':eventId')
  async createOrUpdateCoupon(
    @Param('eventId') eventId: string,
    @Body('name') name: string,
    @Body('discount') discount: number,
  ) {
    return this.cuponsService.createOrUpdateCoupon(eventId, name, discount);
  }

  @Get(':eventId')
  async getCupons(@Param('eventId') eventId: string) {
    return this.cuponsService.getCupons(eventId);
  }

  @Delete(':eventId')
  async deleteCoupon(
    @Param('eventId') eventId: string,
    @Query('name') name: string,
  ) {
    return this.cuponsService.deleteCoupon(eventId, name);
  }
}
