import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Headers,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { SpotsService } from './spots.service';
import { CreateSpotDto } from './dto/create-spot.dto';
import { AuthService } from 'src/firebase/auth.service';

@Controller('events/:eventId/spots')
export class SpotsController {
  constructor(
    private readonly spotsService: SpotsService,
    private readonly authService: AuthService,
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
    @Body() createSpotDto: CreateSpotDto,
    @Param('eventId') eventId: string,
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.spotsService.create({
      ...createSpotDto,
      eventId,
    });
  }

  @Get()
  async findAll(@Param('eventId') eventId: string) {
    return this.spotsService.findAll(eventId);
  }

  @Get(':spotId')
  async findOne(
    @Param('eventId') eventId: string,
    @Param('spotId') spotId: string,
  ) {
    return this.spotsService.findOne(eventId, spotId);
  }

  @Delete(':spotId')
  async remove(
    @Param('eventId') eventId: string,
    @Param('spotId') spotId: string,
  ) {
    return this.spotsService.remove(eventId, spotId);
  }
}
