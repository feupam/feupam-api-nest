import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirestoreService } from './firebase.service';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;
  constructor(private firestoreService: FirestoreService) {}

  // Função para verificar o token JWT
  async verifyToken(token: string): Promise<admin.auth.DecodedIdToken> {
    try {
      const secretKey = process.env.PASS_KEY;
      const decodedToken: any = jwt.verify(token, secretKey);

      return decodedToken;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token AQUI');
    }
  }

  // Função para validar o usuário usando email e senha
  async validateUser(email: string, password: string): Promise<string> {
    try {
      const userRecord = await this.firestoreService.firestore
        .collection('users')
        .where('email', '==', email)
        .get();
      const secretKey = process.env.PASS_KEY;
      const hashedPassword = await bcrypt.hash(password, this.saltRounds);

      if (userRecord.empty) {
        await this.firestoreService.firestore.collection('users').doc().set({
          email: email,
          password: hashedPassword,
        });
        const customToken = jwt.sign({ email }, secretKey, {
          expiresIn: '1h',
        });
        return customToken;
      } else {
        const doc = userRecord.docs[0];
        const data = doc.data();
        const isMatch = await bcrypt.compare(password, data.password);
        if (isMatch) {
          const customToken = jwt.sign({ email }, secretKey, {
            expiresIn: '1h',
          });
          return customToken;
        } else {
          throw new Error('falha');
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      throw new UnauthorizedException('Invalid email or password');
    }
  }
}
