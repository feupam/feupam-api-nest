import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import path from 'path';

@Injectable()
export class FirestoreService {
  public firestore: admin.firestore.Firestore;
  public admin: typeof admin;
  public auth: admin.auth.Auth;

  constructor() {
    const isRunningInFirebase = process.env.FUNCTIONS_EMULATOR || process.env.K_SERVICE;

    if (!admin.apps.length) {
      if (isRunningInFirebase) {
        admin.initializeApp();
      } else {
        const serviceAccountPath = path.resolve(__dirname, '..', '..', 'firebase_key.json');
        if (!fs.existsSync(serviceAccountPath)) {
          throw new Error('Arquivo firebase_key.json não encontrado.');
        }

        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: 'https://federa-api.firebaseio.com',
        });
      }
    }

    this.firestore = admin.firestore();
    this.admin = admin;
    this.auth = admin.auth();
  }

  getFirestore(): admin.firestore.Firestore {
    return this.firestore;
  }

  getAuth(): admin.auth.Auth {
    return this.auth;
  }

  getAdmin(): typeof admin {
    return this.admin;
  }
}
