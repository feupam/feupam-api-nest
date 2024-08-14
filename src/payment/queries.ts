import { ChargeDto } from './dto/create-payment.dto';
import { FirestoreService } from '../firebase/firebase.service';

export class Queries {
  firestoreService: FirestoreService;
  constructor(firestoreService: FirestoreService) {
    this.firestoreService = firestoreService;
  }

  public async getUserByEmail(email: string) {
    const user: any = [];
    const userQuery = this.firestoreService.firestore
      .collection('users')
      .where('email', '==', email);
    const queryUser = await userQuery.get();
    queryUser.forEach((doc) => user.push(doc.data()));
    return user;
  }

  public async getReservationByEmailAndEvent(
    email: string,
    eventId: string,
  ): Promise<any[]> {
    const hist: any = [];
    const reservationQuery = this.firestoreService.firestore
      .collection('reservationHistory')
      .where('email', '==', email)
      .where('eventId', '==', eventId);
    const querySnapshot = await reservationQuery.get();
    querySnapshot.forEach((doc) => hist.push(doc.data()));
    return hist;
  }

  public async updateReservationStatus(
    email: string,
    eventId: string,
    charge: ChargeDto,
    status: string,
  ) {
    const reservationQuery = this.firestoreService.firestore
      .collection('reservationHistory')
      .where('email', '==', email)
      .where('eventId', '==', eventId);
    const querySnapshot = await reservationQuery.get();

    const updatePromises = querySnapshot.docs.map(async (doc) => {
      const docData = doc.data();
      const updatedCharges = docData.charges || [];
      updatedCharges.push(charge);
      return doc.ref.update({
        charges: updatedCharges,
        status: status,
      });
    });

    await Promise.all(updatePromises);
  }

  public async updateChargeStatus(
    email: string,
    chargeId: string,
    status: string,
  ): Promise<void> {
    const reservationQuery = this.firestoreService.firestore
      .collection('reservationHistory')
      .where('email', '==', email);
    const querySnapshot = await reservationQuery.get();

    const updatePromises = querySnapshot.docs.map(async (doc) => {
      const docData = doc.data();
      if (Array.isArray(docData.charges)) {
        const chargeIndex = docData.charges.findIndex(
          (charge: any) => charge.chargeId === chargeId,
        );

        if (chargeIndex !== -1) {
          docData.charges[chargeIndex].status = status;
          await doc.ref.update({
            status: status,
            charges: docData.charges,
          });
        }
      }
    });

    await Promise.all(updatePromises);
  }
}
