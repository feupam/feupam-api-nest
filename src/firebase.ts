import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import * as functions from 'firebase-functions';
import { AppModule } from './app.module';

const server = express();

async function createNestServer(expressInstance: express.Express) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(expressInstance));
  app.enableCors();
  await app.init();
}

createNestServer(server);

export const api = functions.https.onRequest(server);
