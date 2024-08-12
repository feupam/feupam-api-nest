import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { StaffPassService } from './staff-pass.service';
import { AuthService } from '../firebase/auth.service';

@Controller('staffpass')
export class StaffPassController {
  constructor(
    private readonly staffPassService: StaffPassService,
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
  async create(
    @Param('eventId') eventId: string,
    @Body() body: { staff_pass: string },
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.staffPassService.create(eventId, body.staff_pass);
  }

  @Patch(':eventId')
  async update(
    @Param('eventId') eventId: string,
    @Body() body: { staff_pass: string },
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.staffPassService.update(eventId, body.staff_pass);
  }

  @Delete(':eventId')
  async remove(
    @Param('eventId') eventId: string,
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.staffPassService.remove(eventId);
  }

  @Get(':eventId')
  async read(
    @Param('eventId') eventId: string,
    @Body() body: { staff_pass: string },
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.staffPassService.read(eventId, body.staff_pass);
  }
}
