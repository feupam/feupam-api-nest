import {
  Controller,
  Post,
  Get,
  Body,
  Patch,
  Param,
  Headers,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthService } from '../firebase/auth.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  @Post('discount')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async applyDiscount(
    @Body() body: { email: string; discount: number, event: string },
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.adminService.applyDiscount(body.email, body.discount, body.event);
  }

  @Post('fast-user')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async createFastUser(
    @Body() body: { email: string },
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.adminService.createFastUser(body.email);
  }

  @Post(':id/free-event')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async freeEvent(
    @Param('id') eventId: string,
    @Body() body: { email: string },
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.adminService.freeEvent(body.email, eventId);
  }

  @Patch('set-staff')
  async setStaffStatus(
    @Body() body: { email: string; isStaff: boolean },
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.adminService.setStaffStatus(body.email, body.isStaff);
  }

  @Patch('update-email')
  async updateEmail(
    @Body() body: { email: string; newEmail: string },
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.adminService.updateEmail(body.email, body.newEmail);
  }

  @Get('reservation-history')
  async getAllReservationHistory(
    @Headers('Authorization') authHeader: string,
    @Query('eventId') eventId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.adminService.getAllReservationHistory(
      eventId,
      Number(page),
      Number(limit),
    );
  }
}
