// src/durable-objects/kv-store.js
import { DurableObject } from "cloudflare:workers";

export class KeyValueStore extends DurableObject {
  async get(key) {
    return await this.ctx.storage.get(key);
  }

  async set(key, value) {
    await this.ctx.storage.put(key, value);
    return { key, value };
  }
}