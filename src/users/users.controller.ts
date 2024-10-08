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
    const decodedIdToken = await this.authService.verifyToken(token);
    return this.usersService.create(createUserDto, decodedIdToken.email);
  }

  @Get('list-users')
  async findAll(@Headers('Authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.usersService.findAll();
  }

  @Get()
  async findOne(@Headers('Authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];
    const decodedIdToken = await this.authService.verifyToken(token);
    return this.usersService.findOne(decodedIdToken.email);
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
}
