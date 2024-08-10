import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { StaffPassService } from './staff-pass.service';

@Controller('staffpass')
export class StaffPassController {
  constructor(private readonly staffPassService: StaffPassService) {}

  @Post(':eventId')
  async create(
    @Param('eventId') eventId: string,
    @Body() body: { staff_pass: string },
  ) {
    return this.staffPassService.create(eventId, body.staff_pass);
  }

  @Patch(':eventId')
  async update(
    @Param('eventId') eventId: string,
    @Body() body: { staff_pass: string },
  ) {
    return this.staffPassService.update(eventId, body.staff_pass);
  }

  @Delete(':eventId')
  async remove(@Param('eventId') eventId: string) {
    return this.staffPassService.remove(eventId);
  }

  @Get(':eventId')
  async read(
    @Param('eventId') eventId: string,
    @Body() body: { staff_pass: string },
  ) {
    return this.staffPassService.read(eventId, body.staff_pass);
  }
}
