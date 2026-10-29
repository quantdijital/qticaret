import { safeFetch } from "../security/safe-fetch"
import type { SafeFetchOptions, SafeFetchResponse } from "../security/safe-fetch"

/**
 * How a webhook leaves (F11.7): through `safe-fetch`, which refuses an
 * address inside (KK3). Tests point `send` at their own receiver; nothing
 * else replaces it.
 */
export const webhookTransport: {
  send: (url: string, options: SafeFetchOptions) => Promise<SafeFetchResponse>
} = {
  send: (url, options) => safeFetch(url, options),
}
