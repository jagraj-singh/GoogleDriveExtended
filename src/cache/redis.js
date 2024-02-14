import { Redis } from "ioredis"

export class RedisClient {
  static #client
  static getClient() {
    if (!["connect", "connecting"].includes(this.#client?.status)) {
      this.#client = new Redis()
    }
    return this.#client
  }
}
