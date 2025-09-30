import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Headers,
  UsePipes,
  ValidationPipe,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthService } from '../firebase/auth.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
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
    @Body() createUserDto: CreateUserDto,
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    const decoded_token = await this.authService.verifyToken(token);
    return this.usersService.create(createUserDto, decoded_token.email);
  }

  @Get('list-users')
  async findAll(
    @Headers('Authorization') authHeader: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.usersService.findAll(Number(page), Number(limit));
  }

  @Get()
  async findOne(@Headers('authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];
    const decodedIdToken = await this.authService.verifyToken(token);
    return this.usersService.findOne(decodedIdToken);
  }

  @Patch()
  async update(
    @Body() updateUserDto: UpdateUserDto,
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    const decodedIdToken = await this.authService.verifyToken(token);
    return this.usersService.update(decodedIdToken, updateUserDto);
  }

  @Delete()
  async remove(@Headers('authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];
    const decodedIdToken = await this.authService.verifyToken(token);
    return this.usersService.remove(decodedIdToken);
  }

  @Get('reservations')
  async getUserReservations(@Headers('authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];
    const decodedIdToken = await this.authService.verifyToken(token);
    return await this.usersService.getUserReservations(decodedIdToken);
  }

  @Patch('cancel-reservation')
  async cancelUserReservations(@Headers('authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];
    const decodedIdToken = await this.authService.verifyToken(token);
    return await this.usersService.cancelUserReservations(decodedIdToken);
  }

  @Get('reservations-report')
  async getUsersWithReservations(
    @Headers('authorization') authHeader: string,
    @Query('eventId') eventId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return await this.usersService.getUsersWithReservations(
      eventId,
      Number(page),
      Number(limit),
    );
  }
}