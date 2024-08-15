import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Headers,
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
    @Headers('authorization') authHeader: string,
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
    @Headers('authorization') authHeader: string,
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
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.adminService.freeEvent(body.email, eventId);
  }

  @Patch('set-staff')
  async setStaffStatus(
    @Body() body: { email: string; isStaff: boolean },
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.adminService.setStaffStatus(body.email, body.isStaff);
  }

  @Patch('update-email')
  async updateEmail(
    @Body() body: { email: string; newEmail: string },
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.adminService.updateEmail(body.email, body.newEmail);
  }
}
