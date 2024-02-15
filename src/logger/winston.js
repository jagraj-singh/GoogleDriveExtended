import winston from "winston"
import dotenv from "dotenv"

dotenv.config()

export class WinstonLogger {
  static #logger
  //ensuring singleton redis client
  static getLogger() {
    if (!this.#logger) {
      this.#logger = winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        transports: [
          new winston.transports.Console(),
          new winston.transports.File({ filename: "combined.log" }),
        ],
      })
    }
    return this.#logger
  }
}
