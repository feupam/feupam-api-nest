import * as functions from 'firebase-functions';
import { createNestApp, expressApp } from './main';

const nestAppPromise = createNestApp();

export const api = functions.https.onRequest(async (req, res) => {
  await nestAppPromise;
  return expressApp(req, res);
});
