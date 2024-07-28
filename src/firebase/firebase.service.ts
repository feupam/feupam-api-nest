import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirestoreService {
  batch() {
    throw new Error('Method not implemented.');
  }
  collection(arg0: string) {
    throw new Error('Method not implemented.');
  }
  public firestore: admin.firestore.Firestore;

  constructor() {
    admin.initializeApp({
      credential: admin.credential.cert('firebase_key.json'),
      databaseURL: 'https://federa-api.firebaseio.com',
    });
    this.firestore = admin.firestore();
  }

  getFirestore(): admin.firestore.Firestore {
    return this.firestore;
  }
}
