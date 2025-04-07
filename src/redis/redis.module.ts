import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Module({
  providers: [RedisService],
  exports: [RedisService], // Exporta o serviço para ser usado em outros módulos
})
export class RedisModule {}
