import { Controller, Post } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(
    //private readonly authService: AuthService
  ) {}

  @Post('login')
  async login() {
    //const { email } = body;
    //const token = await this.authService.verifyToken(email);
    //return { token };
    return ""
  }
}
