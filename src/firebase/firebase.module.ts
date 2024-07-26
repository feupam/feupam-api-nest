import { Module } from '@nestjs/common';
import { FirestoreService } from './firebase.service';

@Module({
  providers: [FirestoreService],
  exports: [FirestoreService],
})
export class FirebaseModule {}
