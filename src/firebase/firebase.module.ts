import { Module } from '@nestjs/common';
import { FirestoreService } from './firebase.service';
// import { AuthService } from './auth.service';

@Module({
  imports: [],
  providers: [FirestoreService],
  exports: [FirestoreService],
})
export class FirebaseModule {}
