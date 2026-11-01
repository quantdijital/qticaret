import type { StorefrontEnv } from "../env"

let lookup: Promise<string> | undefined

/**
 * The sales channel's publishable key: the configured one, or on a
 * developer's machine the demo store's from the backend's
 * `/dev/storefront-key` (adr/0046 §13), asked once per process.
 */
export function publishableKey(env: StorefrontEnv): Promise<string> {
  if (env.STOREFRONT_PUBLISHABLE_KEY) {
    return Promise.resolve(env.STOREFRONT_PUBLISHABLE_KEY)
  }
  if (env.NODE_ENV === "production") {
    return Promise.reject(new Error("STOREFRONT_PUBLISHABLE_KEY is missing"))
  }
  lookup ??= fetch(new URL("/dev/storefront-key", env.MEDUSA_BACKEND_URL), {
    signal: AbortSignal.timeout(5000),
  })
    .then(async (response) => {
      const body = (await response.json()) as { publishable_key?: unknown }
      if (!response.ok || typeof body.publishable_key !== "string") {
        throw new Error(
          "the backend has no demo storefront key: run `pnpm --filter backend seed:demo`"
        )
      }
      return body.publishable_key
    })
    .catch((error: unknown) => {
      lookup = undefined
      throw error
    })
  return lookup
}
