import { randomUUID } from "node:crypto"
import path from "node:path"
import Redis from "ioredis"

/** What the locking module asks of a provider, as the tests use it. */
export interface Provider {
  acquire(keys: string | string[], args?: { expire?: number; ownerId?: string }): Promise<void>
  release(keys: string | string[], args?: { ownerId?: string }): Promise<boolean>
  execute<T>(
    keys: string | string[],
    job: () => Promise<T>,
    args?: { timeout?: number; expire?: number }
  ): Promise<T>
}

export interface Made {
  provider: Provider
  close: () => Promise<void>
}

// Medusa's own providers, the module's code as it runs (not exported by name):
// locally TEST_REDIS_URL=redis://localhost:56379/15, CI's quality job has a Redis
const packageDir = (name: string, from: string) =>
  path.dirname(require.resolve(name, { paths: [path.dirname(require.resolve(from))] }))
const redisUrl = process.env["TEST_REDIS_URL"]

export const silent = { warn: () => undefined, error: () => undefined, info: () => undefined }

async function inMemory(): Promise<Made> {
  const dir = packageDir("@medusajs/locking", "@medusajs/medusa/locking")
  const { InMemoryLockingProvider } = (await import(path.join(dir, "providers/in-memory.js"))) as {
    InMemoryLockingProvider: new () => Provider
  }
  return { provider: new InMemoryLockingProvider(), close: () => Promise.resolve() }
}

async function redis(): Promise<Made> {
  const dir = packageDir("@medusajs/locking-redis", "@medusajs/medusa/locking-redis")
  const { RedisLockingProvider } = (await import(path.join(dir, "services/redis-lock.js"))) as {
    RedisLockingProvider: new (deps: object, options: object) => Provider
  }
  const client = new Redis(redisUrl ?? "")
  const provider = new RedisLockingProvider(
    { redisClient: client, prefix: `qt:test:lock:${randomUUID()}:`, logger: silent },
    {}
  )
  return { provider, close: () => client.quit().then(() => undefined) }
}

/** The in-memory provider always; Redis's when TEST_REDIS_URL is set. */
export const providers = [
  { name: "in-memory", make: inMemory },
  ...(redisUrl === undefined ? [] : [{ name: "redis", make: redis }]),
]

/** Whether nobody holds `key`: taken and given straight back. */
export async function isFree(provider: Provider, key: string): Promise<boolean> {
  try {
    await provider.acquire(key, { expire: 60 })
  } catch {
    return false
  }
  await provider.release(key)
  return true
}

/** Two keys no other test uses. */
export const twoKeys = () => {
  const prefix = randomUUID()
  return { a: `${prefix}:a`, b: `${prefix}:b` }
}
