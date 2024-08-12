import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirestoreService } from './firebase.service';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

@Injectable()
export class AuthService {
  constructor(private firestoreService: FirestoreService) {}

  // Função para verificar o token JWT
  async verifyToken(token: string): Promise<admin.auth.DecodedIdToken> {
    try {
      const decodedToken = await this.firestoreService
        .getAuth()
        .verifyIdToken(token);
      console.log('jajaja');
      return decodedToken;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // Função para validar o usuário usando email e senha
  async validateUser(email: string): Promise<string> {
    try {
      const userRecord = await this.firestoreService.auth.getUserByEmail(email);

      // Se o usuário for encontrado, você pode gerar um token personalizado aqui
      if (userRecord) {
        // Gerar um token personalizado (opcional)
        const customToken = await admin
          .auth()
          .createCustomToken(userRecord.uid);
        return customToken;
      } else {
        throw new UnauthorizedException('Invalid email or password');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Log detailed error from Axios
        console.error(
          'Authentication error:',
          error.response?.data || error.message,
        );
      } else {
        // Log general error
        console.error('Unexpected error:', error);
      }
      throw new UnauthorizedException('Invalid email or password');
    }
  }
}
