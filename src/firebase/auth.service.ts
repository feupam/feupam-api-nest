// import { Injectable, UnauthorizedException } from '@nestjs/common';
// import { FirestoreService } from './firebase.service';
// import * as admin from 'firebase-admin';

// @Injectable()
// export class AuthService {
//   constructor(private readonly firestoreService: FirestoreService) {}

//   async verifyToken(token: string): Promise<admin.auth.DecodedIdToken> {
//     try {
//       const decodedToken = await this.firestoreService
//         .getAuth()
//         .verifyIdToken(token);
//       return decodedToken;
//     } catch (error) {
//       throw new UnauthorizedException('Invalid or expired token');
//     }
//   }
// }
