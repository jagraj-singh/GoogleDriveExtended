import { Redis } from "ioredis"
import dotenv from "dotenv"

dotenv.config()

export class RedisClient {
  static #client
  //ensuring singleton redis client
  static getClient() {
    if (!["connect", "connecting"].includes(this.#client?.status)) {
      this.#client = new Redis(process.env.REDIS_PORT, process.env.REDIS_HOST)
    }
    return this.#client
  }
}
