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
    const isBodyAllowed = ['POST', 'DELETE'].includes(method) && body !== undefined;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(isBodyAllowed ? { 'Content-Type': 'application/json' } : {}),
      },
      body: isBodyAllowed ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) {
      return null;
    }

    const json = await res.json();

    if (!res.ok) {
      throw new Error(`Erro Redis: ${res.status} - ${json.error || JSON.stringify(json)}`);
    }

    return json.result;
  }

  async set(key: string, content: {} ): Promise<void> {
    await this.fetchRedis('POST', `/set/${key}`, content);
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

  async expire(key: string, ttlSeconds: string): Promise<void> {
    await this.fetchRedis('POST', `/expire/${key}`, { seconds: 600 });
  }

  async enqueue(key: string, value: string): Promise<void> {
    await this.fetchRedis('POST', `/rpush/${key}`, { value: value.toString() });
  }

  async dequeue(key: string): Promise<string | null> {
    return await this.fetchRedis('POST', `/lpop/${key}`, {});
  }

  async getQueue(key: string): Promise<string[]> {
    return await this.fetchRedis('GET', `/lrange/${key}?start=0&stop=-1`);
  }

  async isReservationValid(email: string, eventId: string): Promise<boolean> {
    const value = await this.get(`reservation:${email}:${eventId}`);
    
    const parsed = JSON.parse(value);
    const expiresAt = new Date(parsed["expire"]);
    const now = new Date();
  
    const totalGracePeriod = 10 * 60 * 1000; // 10 minutos
    const graceDeadline = expiresAt.getTime() + totalGracePeriod;
    const timeDifference = graceDeadline - now.getTime();
    const expired = timeDifference <= 0;
  
    parsed["status"] = expired ? 'expired' : 'reserved';

    if (expired) {
      await this.deleteReservationKey(email, eventId);
      await this.decr(`event:${eventId}:count:${parsed["gender"]}`);
    }

    return parsed["status"] == "reserved" ;
  }

  async deleteReservationKey(email: string, eventId: string): Promise<void> {
    const key = `reservation:${email}:${eventId}`
    const response = await fetch(`${this.baseUrl}/`, {  // Note a "/" no final
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(["DEL", key]),  // Comando Redis em formato de array
    });
  
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to delete key: ${data.error || 'Unknown error'}`);
    }
  
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
