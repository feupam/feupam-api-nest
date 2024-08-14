import { Module } from '@nestjs/common';
import { CuponsService } from './cupons.service';
import { CuponsController } from './cupons.controller';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [CuponsController],
  providers: [CuponsService],
})
export class CuponsModule {}
