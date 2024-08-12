import { Module } from '@nestjs/common';
import { FirestoreService } from './firebase.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [],
  providers: [FirestoreService, AuthService],
  controllers: [AuthController],
  exports: [FirestoreService, AuthService],
})
export class FirebaseModule {}
