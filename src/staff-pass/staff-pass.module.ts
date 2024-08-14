import { Module } from '@nestjs/common';
import { StaffPassService } from './staff-pass.service';
import { StaffPassController } from './staff-pass.controller';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [StaffPassController],
  providers: [StaffPassService],
})
export class StaffPassModule {}
