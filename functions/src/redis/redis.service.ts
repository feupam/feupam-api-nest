import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

@Injectable()
export class RedisService implements OnModuleInit {
  private baseUrl: string;
  private token: string;
  private readonly logger = new Logger(RedisService.name);

  onModuleInit() {
    this.baseUrl = "https://tight-stud-20647.upstash.io";
    this.token = "AVCnAAIjcDFhOTgyYzE0ZmJlNWQ0MzMzOGQwNTZiMGVjODQwZTNiYXAxMA";

    if (!this.baseUrl || !this.token) {
      this.logger.error('RedisService não inicializado corretamente. Verifique REDIS_REST_URL e REDIS_REST_TOKEN.');
    } else {
      this.logger.log(`RedisService inicializado com URL: ${this.baseUrl}`);
    }
  }

  private async fetchRedis(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: any,
  ): Promise<any> {
    const hasBody = body !== undefined && method === 'POST';
  
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  
    const json = await res.json();
  
    if (!res.ok) {
      throw new Error(`Erro Redis: ${res.status} - ${json.error || JSON.stringify(json)}`);
    }
  
    return json.result;
  }
  

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.fetchRedis('POST', `/set/${key}`, {
      value,
      options: { EX: ttlSeconds },
    });
  }

  async get(key: string): Promise<string | null> {
    return await this.fetchRedis('GET', `/get/${key}`);
  }

  async incr(key: string): Promise<number> {
    return await this.fetchRedis('POST', `/incr/${key}`);
  }

  async decr(key: string): Promise<number> {
    return await this.fetchRedis('POST', `/decr/${key}`);
  }

  async enqueue(key: string, value: string): Promise<void> {
    await this.fetchRedis('POST', `/rpush/${key}`, { value });
  }

  async dequeue(key: string): Promise<string | null> {
    return await this.fetchRedis('POST', `/lpop/${key}`, {});
  }

  async getQueue(key: string): Promise<string[]> {
    return await this.fetchRedis('GET', `/lrange/${key}?start=0&stop=-1`);
  }

  async isReservationValid(email: string, eventId: string): Promise<boolean> {
    const value = await this.get(`reservation:${email}:${eventId}`);
    return value !== null;
  }

  async deleteReservationKey(email: string, eventId: string): Promise<void> {
    await this.fetchRedis('DELETE', `/del/reservation:${email}:${eventId}`);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    const url = `/hset/${key}/${field}/${value}`;
    await this.fetchRedis('POST', url);
  }
  
  async hgetall(key: string): Promise<Record<string, string>> {
    return await this.fetchRedis('GET', `/hgetall/${key}`);
  }
  
  async hdel(key: string): Promise<void> {
    await this.fetchRedis('POST', `/del/${key}`);
  }
  
  async ttl(key: string): Promise<number> {
    const res = await this.fetchRedis('GET', `/ttl/${key}`);
    return parseInt(res, 10);
  }
}
