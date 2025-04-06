import { Injectable, UnauthorizedException } from '@nestjs/common';
import { FirestoreService } from './firebase.service';
// import * as jwt from 'jsonwebtoken';
// import * as bcrypt from 'bcryptjs';
// import * as functions from 'firebase-functions';

@Injectable()
export class AuthService {
  // private readonly saltRounds = 10;
  constructor(private firestoreService: FirestoreService) {}

  async verifyToken(token: string): Promise<{ email: string }> {
    try {
      // Usa o auth do FirestoreService para validar o token
      const decodedToken = await this.firestoreService.getAuth().verifyIdToken(token);
      const email = decodedToken.email;

      if (!email) {
        throw new UnauthorizedException('Email not found in token');
      }

      return { email };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token22');
    }
  }
}