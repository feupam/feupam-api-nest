// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

export const expressApp = express();

export async function createNestApp() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.enableCors();
  await app.init();
  return expressApp;
}

if (!process.env.FUNCTION_NAME) {
  createNestApp().then((app) => {
    app.listen(3000, () => console.log('NestJS running on http://localhost:3000'));
  });
}
