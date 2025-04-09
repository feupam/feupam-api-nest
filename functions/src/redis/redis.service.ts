import { Injectable, OnModuleInit } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class RedisService implements OnModuleInit {
  private baseUrl: string;
  private token: string;

  onModuleInit() {
    this.baseUrl = process.env.REDIS_REST_URL;
    this.token = process.env.REDIS_REST_TOKEN;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await axios.post(
      `${this.baseUrl}/set/${key}`,
      { value, options: { EX: ttlSeconds } },
      { headers: { Authorization: `Bearer ${this.token}` } },
    );
  }

  async get(key: string): Promise<string | null> {
    const response = await axios.get(`${this.baseUrl}/get/${key}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return response.data?.result ?? null;
  }

  async incr(key: string): Promise<number> {
    const response = await axios.post(
      `${this.baseUrl}/incr/${key}`,
      {},
      { headers: { Authorization: `Bearer ${this.token}` } },
    );
    return response.data?.result ?? 0;
  }

  async decr(key: string): Promise<number> {
    const response = await axios.post(
      `${this.baseUrl}/decr/${key}`,
      {},
      { headers: { Authorization: `Bearer ${this.token}` } },
    );
    return response.data?.result ?? 0;
  }

  async enqueue(key: string, value: string): Promise<void> {
    await axios.post(
      `${this.baseUrl}/rpush/${key}`,
      { value },
      { headers: { Authorization: `Bearer ${this.token}` } },
    );
  }

  async dequeue(key: string): Promise<string | null> {
    const response = await axios.post(
      `${this.baseUrl}/lpop/${key}`,
      {},
      { headers: { Authorization: `Bearer ${this.token}` } },
    );
    return response.data?.result ?? null;
  }

  async getQueue(key: string): Promise<string[]> {
    const response = await axios.get(
      `${this.baseUrl}/lrange/${key}?start=0&stop=-1`,
      { headers: { Authorization: `Bearer ${this.token}` } },
    );
    return response.data?.result ?? [];
  }

  async isReservationValid(email: string, eventId: string): Promise<boolean> {
    const reservationKey = `reservation:${email}:${eventId}`;
    const value = await this.get(reservationKey);
    return value !== null;
  }

  async deleteReservationKey(email: string, eventId: string): Promise<void> {
    const reservationKey = `reservation:${email}:${eventId}`;
    await axios.delete(`${this.baseUrl}/del/${reservationKey}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
  }
}