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
  Headers,
  UsePipes,
  ValidationPipe,
  UseInterceptors,
  UploadedFiles
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Public } from '../decorators/public.decorator';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ReserveSpotDto } from './dto/reserve-spot.dto';
import { AuthService } from '../firebase/auth.service';
import 'multer';

interface UploadedEventFiles {
  image_capa?: Express.Multer.File[];
  logo_evento?: Express.Multer.File[];
}

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image_capa', maxCount: 1 },
    { name: 'logo_evento', maxCount: 1 },
  ]))
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async create(
    @Body() createEventDto: CreateEventDto,
    @Headers('Authorization') authHeader: string,
    @UploadedFiles() files: UploadedEventFiles
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.eventsService.create(createEventDto, files);
  }

  @Get()
  async findAll() {
    return this.eventsService.findAll();
  }

  @Public()
  @Get('event-status')
  async getRegistrationStatus() {
    return this.eventsService.checkRegistrationStatus();
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.eventsService.findOne(id);
  }

  @Put(':id')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image_capa', maxCount: 1 },
    { name: 'logo_evento', maxCount: 1 },
  ]))
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
    @Headers('Authorization') authHeader: string,
    @UploadedFiles() files: UploadedEventFiles
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.eventsService.update(id, updateEventDto, files);
  }

  @HttpCode(204)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
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
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    const decoded = await this.authService.verifyToken(token);
    const updatedDto = {
      ...dto,
      eventId,
    };
    try {
      console.log(`[DEBUG] Reserve spot called for email: ${decoded.email}, eventId: ${eventId}`);
      const reservation = await this.eventsService.reserveSpot(
        updatedDto,
        decoded.email,
      );
      console.log(`[DEBUG] Reserve spot successful:`, reservation);
      return reservation;
    } catch (error) {
      const err = error as Error;
      console.log(`[DEBUG] Reserve spot error:`, {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      if (err.message.includes('Spots') || err.message.includes('not found')) {
        throw new HttpException(err.message, HttpStatus.NOT_FOUND);
      } else if (
        err.message.includes('User already has a reservation for this event')
      ) {
        throw new HttpException(err.message, HttpStatus.CONFLICT);
      } else if (err.message.includes('exceeds the limit')) {
        throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
      } else {
        console.log(`[DEBUG] Throwing internal server error for:`, err.message);
        throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }

  @Get(':id/check-spot')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async checkSpot(
    @Param('id') eventId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    try {
      const reservation = await this.eventsService.checkSpot(eventId);
      return reservation;
    } catch (error) {
      const err = error as Error;
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  
  @Get(':id/stats')
  async getEventStats(
    @Param('id') eventId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    
    try {
      return await this.eventsService.getEventStats(eventId);
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        throw new NotFoundException(err.message);
      }
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id/reservations')
  async getEventReservations(
    @Param('id') id: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
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
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    const decoded = await this.authService.verifyToken(token);
    return this.eventsService.getInstallments(eventId, decoded.email);
  }

  @Get(':id/waiting-list')
  async getWaitingList(
    @Param('id') id: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.eventsService.getWaitingList(id);
  }

  @Post(':id/recalculate-stats')
  async recalculateEventStats(
    @Param('id') eventId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    
    await this.eventsService.recalculateEventStats(eventId);
    
    return {
      success: true,
      message: `Estatísticas do evento ${eventId} recalculadas com sucesso.`,
      timestamp: new Date().toISOString()
    };
  }

  @Get(':id/stats-detailed')
  async getDetailedEventStats(
    @Param('id') eventId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    
    // Forçar recálculo das estatísticas antes de buscar
    // para garantir que inclua dados da reservationHistory
    await this.eventsService.recalculateEventStats(eventId);
    
    return this.eventsService.getEventStats(eventId);
  }

  @Post(':id/clear-cache')
  async clearEventCache(
    @Param('id') eventId: string,
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    
    await this.eventsService.clearEventCache(eventId);
    
    return {
      success: true,
      message: `Cache do evento ${eventId} limpo com sucesso.`,
      timestamp: new Date().toISOString()
    };
  }

  @Post('clear-all-cache')
  async clearAllCache(
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    
    await this.eventsService.clearAllCache();
    
    return {
      success: true,
      message: 'Todo o cache foi limpo com sucesso.',
      timestamp: new Date().toISOString()
    };
  }

  @Post('jobs/start')
  async forceStartJobs(
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    
    await this.eventsService.forceStartJobs();
    
    return {
      success: true,
      message: 'Jobs de limpeza foram iniciados forçadamente.',
      timestamp: new Date().toISOString()
    };
  }

  @Post('jobs/stop')
  async forceStopJobs(
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    
    await this.eventsService.forceStopJobs();
    
    return {
      success: true,
      message: 'Jobs de limpeza foram parados forçadamente.',
      timestamp: new Date().toISOString()
    };
  }

  @Get('jobs/status')
  async getJobsStatus(
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    
    const status = await this.eventsService.getJobsStatus();
    
    return {
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    };
  }

  @Post('cleanup-legacy')
  async cleanupLegacyData(
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    
    await this.eventsService.cleanupLegacyData();
    
    return {
      success: true,
      message: 'Limpeza de dados antigos (status "expired") executada com sucesso.',
      timestamp: new Date().toISOString()
    };
  }
}