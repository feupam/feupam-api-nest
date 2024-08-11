import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CuponsService } from './cupons.service';
import { AuthService } from 'src/firebase/auth.service';

@Controller('cupons')
export class CuponsController {
  constructor(
    private readonly cuponsService: CuponsService,
    private readonly authService: AuthService,
  ) {}

  @Post(':eventId')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async createOrUpdateCoupon(
    @Param('eventId') eventId: string,
    @Body('name') name: string,
    @Body('discount') discount: number,
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.cuponsService.createOrUpdateCoupon(eventId, name, discount);
  }

  @Get(':eventId')
  async getCupons(
    @Param('eventId') eventId: string,
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.cuponsService.getCupons(eventId);
  }

  @Delete(':eventId')
  async deleteCoupon(
    @Param('eventId') eventId: string,
    @Query('name') name: string,
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.cuponsService.deleteCoupon(eventId, name);
  }
}
