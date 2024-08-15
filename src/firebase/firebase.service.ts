import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirestoreService {
  public firestore: admin.firestore.Firestore;
  public admin: typeof admin;
  public auth: admin.auth.Auth;

  constructor() {
    admin.initializeApp({
      credential: admin.credential.cert('firebase_key.json'),
      databaseURL: 'https://federa-api.firebaseio.com',
    });
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
