import * as functions from 'firebase-functions';
import { createNestApp, expressApp } from './main';
import { unlockQueue } from './redis/unlock-cron';

const nestAppPromise = createNestApp(); // cria e reusa

export const api = functions.https.onRequest(async (req, res) => {
  await nestAppPromise; // garante que está pronto
  return expressApp(req, res); // expressApp é o handler real
});

export { unlockQueue };
