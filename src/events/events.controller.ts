import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ReserveSpotDto } from './dto/reserve-spot.dto';

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

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }

  @Post(':eventId/reserve-spot')
  async reserveSpot(
    @Param('eventId') eventId: string,
    @Body() reserveSpotDto: ReserveSpotDto,
  ) {
    // Assumindo que o userId vem do JWT ou algum outro método de autenticação
    const userId = 'user-id-placeholder'; // Substitua com a forma correta de obter o ID do usuário
    return this.eventsService.reserveSpot({
      ...reserveSpotDto,
      eventId,
      userId,
    });
  }
}
