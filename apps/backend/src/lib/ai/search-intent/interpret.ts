import { createTtlCache } from "../../cache"
import { logger } from "../../logging"
import { normalizeText } from "../../search"
import { todayIn } from "../../seo/facets-dated"
import { fallbackAnswer, searchAnswer } from "./answer"
import type { DroppedPart, SearchFilter, SearchInterpretation, SearchLists } from "./types"

/**
 * A sentence's interpretation with its day's cache (adr/0077 §7): the
 * same sentence (as the site search compares words) on the same day is
 * read once in 24 hours, so a repeated or popular sentence costs one
 * call. Only an answer the service gave is kept; a failure (the flag
 * off, no key, the ceiling reached, the service down or its answer no
 * filter) is not, and the sentence is searched as it is. The key is the
 * folded sentence in process memory only; the log holds no text.
 */

/** What the workflow gives back (workflows/ai/interpret-search.ts). */
export interface InterpretRun {
  lists: SearchLists
  status: string
  filter: SearchFilter | null
  dropped: DroppedPart[]
}

export const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const SEARCH_CACHE_ENTRIES = 2_000

interface Kept {
  filter: SearchFilter
  dropped: DroppedPart[]
  lists: SearchLists
}

/** A run that gave no filter: not kept, and searched as the sentence. */
class NoFilter extends Error {
  constructor(readonly reason: string) {
    super("search_intent.no_filter")
  }
}

// An error's key when it is one of ours (`ai.daily_limit_reached`), never its text otherwise
const reasonOf = (error: unknown): string => {
  if (error instanceof NoFilter) {
    return error.reason
  }
  const safe = (error as { safeMessage?: unknown } | null)?.safeMessage
  const message = typeof safe === "string" ? safe : error instanceof Error ? error.message : ""
  return /^ai\.[a-z_]{1,60}$/.test(message) ? message : "error"
}

export function createSearchInterpreter(
  options: { ttlMs?: number; maxEntries?: number; now?: () => Date } = {}
) {
  const now = options.now ?? (() => new Date())
  const cache = createTtlCache<Kept>({
    ttlMs: options.ttlMs ?? SEARCH_CACHE_TTL_MS,
    maxEntries: options.maxEntries ?? SEARCH_CACHE_ENTRIES,
    now: () => now().getTime(),
  })
  return async (
    text: string,
    run: (text: string) => Promise<InterpretRun>
  ): Promise<SearchInterpretation> => {
    const folded = normalizeText(text)
    if (folded === "") {
      return fallbackAnswer(text)
    }
    // Today in the key: "bu hafta sonu" means another range tomorrow
    const key = `${todayIn(now())}|${folded}`
    try {
      const kept = await cache(key, async () => {
        const result = await run(text)
        if (result.status !== "succeeded" || result.filter === null) {
          throw new NoFilter(result.status)
        }
        return { filter: result.filter, dropped: result.dropped, lists: result.lists }
      })
      return searchAnswer(text, kept.filter, kept.dropped, kept.lists)
    } catch (error) {
      logger.info({ event: "ai.search_fallback", reason: reasonOf(error) })
      return fallbackAnswer(text)
    }
  }
}

/** The instance's interpreter, its cache shared by every request. */
export const interpretSearch = createSearchInterpreter()
