import type Redis from "ioredis"
import { createRedisClient as createClient } from "@qticaret/server-kit"
import { errorSummary, logger } from "../logging"

/**
 * The shared Redis client (`@qticaret/server-kit`, adr/0061) with its
 * outage logged under `<name>.redis_error`, once a minute.
 */
export function createRedisClient(redisUrl: string, name: string): Redis {
  return createClient(redisUrl, (error) => {
    logger.warn({ event: `${name}.redis_error`, err: errorSummary(error) })
  })
}
