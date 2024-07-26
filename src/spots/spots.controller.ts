import { Controller, Post, Get, Delete, Param, Body } from '@nestjs/common';
import { SpotsService } from './spots.service';
import { CreateSpotDto } from './dto/create-spot.dto';

@Controller('spots')
export class SpotsController {
  constructor(private readonly spotsService: SpotsService) {}

  @Post()
  async create(@Body() createSpotDto: CreateSpotDto & { eventId: string }) {
    return this.spotsService.create(createSpotDto);
  }

  @Get(':eventId')
  async findAll(@Param('eventId') eventId: string) {
    return this.spotsService.findAll(eventId);
  }

  @Get(':eventId/:spotId')
  async findOne(
    @Param('eventId') eventId: string,
    @Param('spotId') spotId: string,
  ) {
    return this.spotsService.findOne(eventId, spotId);
  }

  @Delete(':eventId/:spotId')
  async remove(
    @Param('eventId') eventId: string,
    @Param('spotId') spotId: string,
  ) {
    return this.spotsService.remove(eventId, spotId);
  }
}
