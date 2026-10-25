import Redis from "ioredis"
import { errorSummary, logger } from "../logging"

const ERROR_LOG_EVERY_MS = 60_000

/**
 * A Redis client of our own (Medusa does not expose its connection) for
 * small, fast commands: they wait for the connection, so the first ones
 * after start are not lost, but give up within one retry and the command
 * timeout when Redis is down, and callers fall back. Errors are logged once
 * a minute: ioredis reconnects every few seconds during an outage.
 */
export function createRedisClient(redisUrl: string, name: string): Redis {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: true,
    connectTimeout: 2_000,
    commandTimeout: 500,
    lazyConnect: false,
  })
  let lastErrorLog = Number.NEGATIVE_INFINITY
  client.on("error", (error: unknown) => {
    if (Date.now() - lastErrorLog >= ERROR_LOG_EVERY_MS) {
      lastErrorLog = Date.now()
      logger.warn({ event: `${name}.redis_error`, err: errorSummary(error) })
    }
  })
  return client
}
