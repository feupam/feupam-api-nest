import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Headers,
  Param,
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
  async create(
    @Body() createUserDto: CreateUserDto,
    @Headers('Authorization') authHeader: string,
  ) {
    const token = authHeader?.split(' ')[1];
    const decodedIdToken = await this.authService.verifyToken(token);
    return this.usersService.create(createUserDto, decodedIdToken.email);
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

  @Get(':id')
  async findOne(@Param('id') id: string, @Headers('Authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.usersService.findOneById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateUserDto: UpdateUserDto,
    @Headers('Authorization') authHeader: string
  ) {
    const token = authHeader?.split(' ')[1];
    await this.authService.verifyToken(token);
    return this.usersService.updateById(id, updateUserDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.usersService.removeById(id);
  }

  @Get('reservations')
  async getUserReservations(@Headers('Authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];
    const decodedIdToken = await this.authService.verifyToken(token);
    return await this.usersService.getUserReservations(decodedIdToken);
  }

  @Patch('cancel-reservation')
  async cancelUserReservations(@Headers('Authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];
    const decodedIdToken = await this.authService.verifyToken(token);
    return await this.usersService.cancelUserReservations(decodedIdToken);
  }
}
