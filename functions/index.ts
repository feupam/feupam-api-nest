import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module'; // ajuste o caminho se necessário
import { ExpressAdapter } from '@nestjs/platform-express';
import * as functions from 'firebase-functions';
import * as express from 'express';

const server = express();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  await app.init();
}

bootstrap();

export const api = functions.https.onRequest(server);
