import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    let authHeader = req.headers.authorization;
    if (!authHeader) {
      authHeader = req.headers.authorization = 'Bearer semtoken';
      return next();
    }
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido ou mal formatado');
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      const secretKey = process.env.PASS_KEY;

      const decodedToken: any = jwt.verify(token, secretKey);
      req['user'] = decodedToken;
      next();
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}