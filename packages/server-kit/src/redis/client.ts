import Redis from "ioredis"

const ERROR_REPORT_EVERY_MS = 60_000

/**
 * A Redis client of our own (Medusa does not expose its connection) for
 * small, fast commands: they wait for the connection, so the first ones
 * after start are not lost, but give up within one retry and the command
 * timeout when Redis is down, and callers fall back. Errors reach `onError`
 * once a minute: ioredis reconnects every few seconds during an outage.
 */
export function createRedisClient(redisUrl: string, onError: (error: unknown) => void): Redis {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: true,
    connectTimeout: 2_000,
    commandTimeout: 500,
    lazyConnect: false,
  })
  let lastReport = Number.NEGATIVE_INFINITY
  client.on("error", (error: unknown) => {
    if (Date.now() - lastReport >= ERROR_REPORT_EVERY_MS) {
      lastReport = Date.now()
      onError(error)
    }
  })
  return client
}
