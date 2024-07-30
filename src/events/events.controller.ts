import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ReserveSpotDto } from '../users/dto/reserve-spot-by-events.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  async create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(createEventDto);
  }

  @Get()
  async findAll() {
    return this.eventsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, updateEventDto);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }

  @Post(':id/reserve-spot')
  async reserveSpots(
    @Body() dto: ReserveSpotDto,
    @Param('id') eventId: string,
  ) {
    // Adicione o eventId e ajuste o DTO com informações adicionais
    const updatedDto = {
      ...dto,
      eventId,
      userType: dto.userType, // Garanta que userType esteja presente
      gender: dto.gender,
    };
    try {
      // Passa o DTO atualizado para o serviço
      const reservation = await this.eventsService.reserveSpot(updatedDto);
      return reservation;
    } catch (error) {
      const err = error as Error;

      // Trate erros específicos
      if (err.message.includes('Spots') || err.message.includes('not found')) {
        throw new HttpException(err.message, HttpStatus.NOT_FOUND);
      } else if (err.message.includes('User already has a reservation')) {
        throw new HttpException(err.message, HttpStatus.CONFLICT);
      } else if (err.message.includes('exceeds the limit')) {
        throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
      } else {
        // Erro genérico
        throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }
}
