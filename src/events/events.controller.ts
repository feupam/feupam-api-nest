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
  NotFoundException,
  // Headers,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ReserveSpotDto } from './dto/reserve-spot.dto';
// import { AuthService } from '../firebase/auth.service';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    // private readonly authService: AuthService,
  ) {}

  @Post()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async create(
    @Body() createEventDto: CreateEventDto,
    // @Headers('authorization') authHeader: string,
  ) {
    // const token = authHeader?.split(' ')[1];
    // await this.authService.verifyToken(token);
    return this.eventsService.create(createEventDto);
  }

  @Get()
  async findAll() {
    // const token = authHeader?.split(' ')[1];
    // await this.authService.verifyToken(token);
    return this.eventsService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    // @Headers('authorization') authHeader: string,
  ) {
    // const token = authHeader?.split(' ')[1];
    // await this.authService.verifyToken(token);
    return this.eventsService.findOne(id);
  }

  @Put(':id')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    // @Headers('authorization') authHeader: string,
  ) {
    // const token = authHeader?.split(' ')[1];
    // await this.authService.verifyToken(token);
    return this.eventsService.update(id, updateEventDto);
  }

  @HttpCode(204)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    // @Headers('authorization') authHeader: string,
  ) {
    // const token = authHeader?.split(' ')[1];
    // await this.authService.verifyToken(token);
    return this.eventsService.remove(id);
  }

  @Post(':id/reserve-spot')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async reserveSpots(
    @Body() dto: ReserveSpotDto,
    @Param('id') eventId: string,
    // @Headers('authorization') authHeader: string,
  ) {
    // const token = authHeader?.split(' ')[1];
    // await this.authService.verifyToken(token);
    // Adicione o eventId e ajuste o DTO com informações adicionais
    const updatedDto = {
      ...dto,
      eventId,
      userType: dto.userType, // Garanta que userType esteja presente
      gender: dto.gender,
      userId: dto.userId,
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
      } else if (
        err.message.includes('User already has a reservation for this event')
      ) {
        throw new HttpException(err.message, HttpStatus.CONFLICT);
      } else if (err.message.includes('exceeds the limit')) {
        throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
      } else {
        // Erro genérico
        throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  @Get(':id/reservations')
  async getEventReservations(
    @Param('id') id: string,
    // @Headers('authorization') authHeader: string,
  ) {
    // const token = authHeader?.split(' ')[1];
    // await this.authService.verifyToken(token);
    const eventReservations =
      await this.eventsService.getAllReservationsByEvent(id);

    if (!eventReservations) {
      throw new NotFoundException('Reservations not found for this event');
    }
    return eventReservations;
  }

  @Get(':id/installments')
  async getInstallments(
    @Param('id') eventId: string,
    // @Headers('authorization') authHeader: string,
  ) {
    // const token = authHeader?.split(' ')[1];
    // await this.authService.verifyToken(token);
    return this.eventsService.getInstallments(eventId);
  }

  @Get(':id/registration-status')
  async getRegistrationStatus(
    @Param('id') id: string,
    // @Headers('authorization') authHeader: string,
  ) {
    // const token = authHeader?.split(' ')[1];
    // await this.authService.verifyToken(token);
    return this.eventsService.checkRegistrationStatus(id);
  }
}
