import { Controller, Post, Get, Delete, Param, Body } from '@nestjs/common';
import { SpotsService } from './spots.service';
import { CreateSpotDto } from './dto/create-spot.dto';

@Controller('events/:eventId/spots')
export class SpotsController {
  constructor(private readonly spotsService: SpotsService) {}

  @Post()
  create(
    @Body() createSpotDto: CreateSpotDto,
    @Param('eventId') eventId: string,
  ) {
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
