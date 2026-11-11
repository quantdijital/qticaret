import {
  MemoryNonceStore,
  RedisNonceStore,
  createRedisClient,
  isLocalEnv,
  tenantNamespace,
} from "@qticaret/server-kit"
import type { NonceStore } from "@qticaret/server-kit"
import { parseEnv } from "../env"

let shared: NonceStore | undefined

/**
 * Where the shops' signed requests' nonces are remembered (adr/0061 §3.2,
 * Ek C9): Redis when `REDIS_URL` is set (`SET NX EX`, shared by every
 * process; the env schema requires it once deployed), else this process's
 * memory, which is allowed in development and test only. A Redis error
 * refuses the request; it never lets a nonce through unchecked.
 */
export function tenantApiNonces(onRedisError: (error: unknown) => void = () => undefined) {
  if (shared) {
    return shared
  }
  const env = parseEnv()
  if (env.REDIS_URL) {
    const namespace = tenantNamespace(env.DATABASE_URL, env.NODE_ENV, process.env["QT_TEST_RUN"])
    shared = new RedisNonceStore(
      createRedisClient(env.REDIS_URL, onRedisError),
      `qt:cp-nonce:${namespace}:`
    )
  } else if (isLocalEnv(env)) {
    shared = new MemoryNonceStore()
  } else {
    // The schema already refuses this; said again where it matters
    throw new Error("REDIS_URL is required for the tenant API's nonces outside development")
  }
  return shared
}
