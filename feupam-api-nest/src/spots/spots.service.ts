import { Injectable } from '@nestjs/common';
import { CreateSpotDto } from './dto/create-spot.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SpotStatus } from '@prisma/client';

@Injectable()
export class SpotsService {
  constructor(private prismaServise: PrismaService) {}

  async create(createSpotDto: CreateSpotDto & { eventId: string }) {
    console.log(createSpotDto);
    const event = await this.prismaServise.event.findFirst({
      where: {
        id: createSpotDto.eventId,
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    return this.prismaServise.spot.create({
      data: {
        ...createSpotDto,
        status: SpotStatus.available,
      },
    });
  }

  findAll(eventId: string) {
    return this.prismaServise.spot.findMany({
      where: {
        eventId,
      },
    });
  }

  findOne(eventId: string, spotId: string) {
    return this.prismaServise.spot.findFirst({
      where: {
        id: spotId,
        eventId,
      },
    });
  }

  // update(eventId: string, spotId: string, updateSpotDto: UpdateSpotDto) {
  //   return this.prismaServise.spot.findFirst({
  //     where: {
  //       id: spotId,
  //       eventId,
  //     },
  //     data: updateSpotDto.name,
  //   });
  // }

  remove(eventId: string, spotId: string) {
    return this.prismaServise.spot.delete({
      where: {
        id: spotId,
        eventId,
      },
    });
  }
}
