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
import { ReserveSpotDto } from '../events/dto/reserve-spot.dto'; // Ajuste o caminho conforme sua estrutura de pastas

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
      if (error.message.includes('User already has a reservation')) {
        throw new ForbiddenException(
          'You already have a reservation for one of the requested spots.',
        );
      }
      if (error.message.includes('Event not found')) {
        throw new NotFoundException('Event not found.');
      }
      if (error.message.includes('Spots not found')) {
        throw new NotFoundException('One or more spots not found.');
      }
      if (error.message.includes('The maximum number of spots')) {
        throw new ConflictException(
          'The maximum number of spots for this event has been reached.',
        );
      }
      throw new Error(error.message);
    }
  }
}
