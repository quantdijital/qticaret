import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { hashPii, parseKey } from "../../lib/crypto/pii"
import { turkishDay } from "../../lib/dashboard"
import { parseEnv } from "../../lib/env"
import { errorSummary, logger } from "../../lib/logging"
import { normalizeSearchTerm } from "../../lib/search"
import { SEARCH_TERMS_MODULE } from "../../modules/search-terms"
import type SearchTermsModuleService from "../../modules/search-terms/service"
import { clientBucket, sharedRateLimitStore } from "./rate-limit"

const DAY_MS = 24 * 60 * 60 * 1000
// New terms a visitor adds to the report a day: a shopper's searches, never a bot's dictionary
export const TERMS_PER_VISITOR = 30

let hashKey: Buffer | undefined

// The counters never hold an address with a term, only a keyed hash of the two
const hashed = (value: string): string => {
  hashKey ??= parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY")
  return hashPii(value, hashKey, "search_terms").slice(0, 32)
}

/**
 * Whether this search counts: a visitor's (IPv6 by its /64) same term once
 * a day, and only its first few terms a day. One script cannot fill the
 * report, nor push a term of its own into the advisor.
 */
async function counts(req: MedusaRequest, term: string): Promise<boolean> {
  const store = sharedRateLimitStore()
  const visitor = clientBucket(req)
  const once = await store.hit(`search:term:${hashed(`${visitor}\n${term}`)}`, DAY_MS)
  if (once.count > 1) {
    return false
  }
  const terms = await store.hit(`search:visitor:${hashed(visitor)}`, DAY_MS)
  return terms.count <= TERMS_PER_VISITOR
}

async function record(req: MedusaRequest, term: string, found: number): Promise<void> {
  if (await counts(req, term)) {
    await req.scope
      .resolve<SearchTermsModuleService>(SEARCH_TERMS_MODULE)
      .record(turkishDay(new Date()), term, found)
  }
}

/**
 * A storefront product search counted (F11.8, adr/0039 §8): its words and
 * whether it found anything, read from the answer Medusa sends. Only the
 * first page is a search (a next page is the same one); a term that may
 * hold a person is not counted. Counting never slows or fails the answer.
 */
export function recordSearchTerms(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const term = normalizeSearchTerm(req.query["q"])
  const offset = Number(req.query["offset"] ?? 0)
  if (!term || offset > 0) {
    next()
    return
  }
  const json = res.json.bind(res)
  res.json = (body: unknown) => {
    try {
      const count = (body as { count?: unknown } | null)?.count
      if (res.statusCode < 400 && typeof count === "number") {
        record(req, term, count).catch((error: unknown) => {
          logger.warn({ event: "search_terms.record_failed", err: errorSummary(error) })
        })
      }
    } catch (error) {
      // Before the answer goes: whatever fails here, the shopper still gets it
      logger.warn({ event: "search_terms.record_failed", err: errorSummary(error) })
    }
    return json(body)
  }
  next()
}
