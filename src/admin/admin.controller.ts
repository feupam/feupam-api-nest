import { Controller, Post, Body, Patch, Param } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('discount')
  applyDiscount(@Body() body: { email: string; discount: number }) {
    return this.adminService.applyDiscount(body.email, body.discount);
  }

  @Post('fast-user')
  createFastUser(@Body() body: { email: string }) {
    return this.adminService.createFastUser(body.email);
  }

  @Post(':id/free-event')
  freeEvent(@Param('id') eventId: string, @Body() body: { email: string }) {
    return this.adminService.freeEvent(body.email, eventId);
  }

  @Patch('set-staff')
  setStaffStatus(@Body() body: { email: string; isStaff: boolean }) {
    return this.adminService.setStaffStatus(body.email, body.isStaff);
  }

  @Patch('update-email')
  updateEmail(@Body() body: { email: string; newEmail: string }) {
    return this.adminService.updateEmail(body.email, body.newEmail);
  }
}
