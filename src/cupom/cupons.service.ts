import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../firebase/firebase.service';

@Injectable()
export class CuponsService {
  constructor(private readonly firestoreService: FirestoreService) {}

  private formatCouponName(name: string): string {
    return name.toUpperCase();
  }

  private validateDiscount(discount: number): boolean {
    return discount > 0 && discount < 1;
  }

  async createOrUpdateCoupon(
    eventId: string,
    name: string,
    discount: number,
  ): Promise<any> {
    const formattedName = this.formatCouponName(name);

    if (!this.validateDiscount(discount)) {
      throw new Error(
        'Discount must be a float greater than 0 and less than 1.',
      );
    }

    const eventRef = this.firestoreService.firestore
      .collection('events')
      .doc(eventId);
    const eventSnapshot = await eventRef.get();
    if (!eventSnapshot.exists) {
      throw new Error('Event not found.');
    }

    const eventData = eventSnapshot.data() || { cupons: [] };
    const cupons = eventData.cupons || [];
    const existingCouponIndex = cupons.findIndex(
      (coupon) => coupon.name === formattedName,
    );

    if (existingCouponIndex > -1) {
      // Update existing coupon
      cupons[existingCouponIndex] = { name: formattedName, discount };
    } else {
      // Add new coupon
      cupons.push({ name: formattedName, discount });
    }

    await eventRef.update({ cupons });
    return cupons;
  }

  async getCupons(eventId: string): Promise<any[]> {
    const eventRef = this.firestoreService.firestore
      .collection('events')
      .doc(eventId);
    const eventSnapshot = await eventRef.get();
    if (!eventSnapshot.exists) {
      throw new Error('Event not found.');
    }

    const eventData = eventSnapshot.data() || { cupons: [] };
    return eventData.cupons || [];
  }

  async deleteCoupon(eventId: string, name: string): Promise<any[]> {
    const formattedName = this.formatCouponName(name);

    const eventRef = this.firestoreService.firestore
      .collection('events')
      .doc(eventId);
    const eventSnapshot = await eventRef.get();
    if (!eventSnapshot.exists) {
      throw new Error('Event not found.');
    }

    const eventData = eventSnapshot.data() || { cupons: [] };
    const cupons = eventData.cupons || [];
    const updatedCupons = cupons.filter(
      (coupon) => coupon.name !== formattedName,
    );

    await eventRef.update({ cupons: updatedCupons });
    return updatedCupons;
  }
}
