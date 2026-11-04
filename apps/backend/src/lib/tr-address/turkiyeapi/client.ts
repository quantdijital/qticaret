import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../../clients"
import type { HttpClientOptions } from "../../clients"
import { parseEnv } from "../../env"
import { isProviderError } from "../../errors"
import { logger } from "../../logging"
import { COLLECTIONS, metaAnswer, pageAnswer } from "./schemas"
import type { CollectionName, CollectionRecord, TurkiyeApiMeta } from "./schemas"

/**
 * TürkiyeAPI v2 (docs/entegrasyonlar/turkiye-api.md): public, no key. A
 * collection comes from its dataset file (`/datasets/<name>.json`, one
 * request: the terms point bulk readers there); when that fails, from its
 * paged list, 1000 records a page. The service limits a client to 300
 * requests a minute; the paged fallback needs about sixty. Over the
 * platform HTTP client: timeout, retries with backoff (429 too, after its
 * Retry-After), a circuit breaker, one log line per attempt without query
 * or body.
 */

export const TURKIYEAPI_PROVIDER = "turkiyeapi"
export const TURKIYEAPI_URL = "https://api.turkiyeapi.dev/v2"

const PAGE_SIZE = 1000
// The largest file (neighbourhoods) is about 9 MB pretty-printed; room for growth
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024
const TIMEOUT_MS = 60_000
// A list larger than this is not a country's: stop paging
const MAX_PAGES = 100

export interface TurkiyeApi {
  meta: () => Promise<TurkiyeApiMeta>
  collection: <N extends CollectionName>(name: N) => Promise<CollectionRecord<N>[]>
}

export type TurkiyeApiOptions = Partial<Omit<HttpClientOptions, "provider" | "baseUrl">> & {
  baseUrl?: string
}

/** The API's root: the real one, or a fake on a developer's machine and in tests. */
export const turkiyeApiUrl = (): string => parseEnv().TURKIYEAPI_BASE_URL ?? TURKIYEAPI_URL

export function createTurkiyeApi(options: TurkiyeApiOptions = {}): TurkiyeApi {
  const { baseUrl = turkiyeApiUrl(), ...rest } = options
  const http = createHttpClient({
    timeoutMs: TIMEOUT_MS,
    maxResponseBytes: MAX_RESPONSE_BYTES,
    ...rest,
    provider: TURKIYEAPI_PROVIDER,
    baseUrl,
    defaultHeaders: { "user-agent": "quant-ticaret" },
  })

  async function paged<N extends CollectionName>(name: N): Promise<CollectionRecord<N>[]> {
    const schema = pageAnswer(COLLECTIONS[name])
    const records: CollectionRecord<N>[] = []
    for (let page = 0; page < MAX_PAGES; page++) {
      const answer = await http.request({
        path: [name],
        query: { limit: PAGE_SIZE, offset: page * PAGE_SIZE, sort: "id" },
        schema,
      })
      records.push(...(answer.data as CollectionRecord<N>[]))
      if (answer.data.length < PAGE_SIZE || records.length >= answer.meta.total) {
        return records
      }
    }
    return records
  }

  return {
    meta: async () => (await http.request({ path: "/meta", schema: metaAnswer })).data,
    collection: async (name) => {
      try {
        return await http.request({
          path: ["datasets", `${name}.json`],
          schema: z.array(COLLECTIONS[name]),
        })
      } catch (error) {
        if (!isProviderError(error)) {
          throw error
        }
        logger.warn({
          event: "tr_address.dataset_file_failed",
          collection: name,
          code: error.providerCode,
        })
        return paged(name)
      }
    },
  }
}
