import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ReserveSpotDto } from './dto/reserve-spot-by-events.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

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
