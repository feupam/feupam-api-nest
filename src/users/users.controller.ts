import {
  Controller,
  Post,
  Body,
  Param,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ReserveSpotDto } from './dto/reserve-spot-by-events.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':userId/reserve-spot')
  async reserveSpot(
    @Param('userId') userId: string,
    @Body() reserveSpotDto: ReserveSpotDto,
  ) {
    try {
      const tickets = await this.usersService.reserveSpot(
        userId,
        reserveSpotDto,
      );
      return { success: true, tickets };
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('User already has a reservation')) {
        throw new ForbiddenException(
          'You already have a reservation for one of the requested spots.',
        );
      }
      if (err.message.includes('Event not found')) {
        throw new NotFoundException('Event not found.');
      }
      if (err.message.includes('Spots not found')) {
        throw new NotFoundException('One or more spots not found.');
      }
      if (err.message.includes('The maximum number of spots')) {
        throw new ConflictException(
          'The maximum number of spots for this event has been reached.',
        );
      }
      throw new Error(err.message);
    }
  }
}
