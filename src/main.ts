import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import * as functions from 'firebase-functions';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function createNestServer(expressInstance: express.Express) {
  const adapter = new ExpressAdapter(expressInstance);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, adapter);
  app.enableCors();
  await app.init();
}

async function bootstrapLocal() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.enableCors();
  await app.listen(3000);
  console.log('NestJS is running on http://localhost:3000');
}

// Verificação do ambiente
const env = functions.config().config?.pagarme_key ?? "";

let server: express.Express | null = null;
let api: functions.HttpsFunction | null = null;

if (env === 'prod') {
  // Ambiente de produção - Firebase Functions
  server = express();
  createNestServer(server)
    .then(() => console.log('NestJS (Firebase Functions) is ready'))
    .catch((err) => console.error('NestJS initialization error', err));

  api = functions.https.onRequest(server);
} else {
  // Ambiente de desenvolvimento local
  bootstrapLocal();
}

// Exporta a função para o Firebase Functions (se estiver em produção)
export { api };
