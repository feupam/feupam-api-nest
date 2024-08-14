import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as functions from 'firebase-functions';
import * as dotenv from 'dotenv';

let cachedApp: any = null;
dotenv.config();

async function createNestServer() {
  if (!cachedApp) {
    const app = await NestFactory.create(AppModule);
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
    cachedApp = app;
  }
  return cachedApp;
}

// Export the NestJS application as a Firebase Function
export const api = functions.https.onRequest(async (req, res) => {
  const app = await createNestServer();
  app.getHttpAdapter().getInstance().use(req, res);
});
