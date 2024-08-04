import { Module } from '@nestjs/common';
import { FirestoreService } from './firebase.service';
import { AuthService } from './auth.service';

@Module({
  imports: [],
  providers: [FirestoreService, AuthService],
  exports: [FirestoreService, AuthService],
})
export class FirebaseModule {}
