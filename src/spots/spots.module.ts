import { Module } from '@nestjs/common';
import { SpotsService } from './spots.service';
import { SpotsController } from './spots.controller';
import { FirebaseModule } from '../firebase/firebase.module';
// import { AuthMiddleware } from '../firebase/auth.middleware';

@Module({
  imports: [FirebaseModule],
  controllers: [SpotsController],
  providers: [SpotsService],
})
export class SpotsModule {}
