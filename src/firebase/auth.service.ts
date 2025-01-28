import { Injectable, UnauthorizedException } from '@nestjs/common';
import { FirestoreService } from './firebase.service';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import * as functions from 'firebase-functions';

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;
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
      throw new UnauthorizedException('Invalid or expired token');
    }
  }


  // Função para validar o usuário usando email e senha
  async validateUser(email: string, password: string): Promise<string> {
    try {
      const userRecord = await this.firestoreService.firestore
        .collection('users')
        .where('email', '==', email)
        .get();
      let secretKey;
      try{
        secretKey = functions.config().config.pass_key
       } catch {
        secretKey = process.env.pass_key;
       }
      
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
      throw new UnauthorizedException('Invalid email or password');
    }
  }
}
