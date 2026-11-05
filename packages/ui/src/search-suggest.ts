import type { SearchSuggestView } from "./listing-views"

/**
 * The header's live search in the browser (2026-11-05), shared by every
 * theme: which words to ask for, when to ask (after a pause, the stale
 * request dropped), the answers kept for the page's life, and how the
 * arrow keys move through the panel's options. No React here: a theme's
 * field calls `ask` from its change handler and draws the state it is
 * told. The address is the storefront's own (the theme's `searchSuggest`),
 * never the backend's (adr/0046 §5).
 */

/** Fewer characters than this, and the live search waits (the storefront refuses fewer). */
export const SUGGEST_MIN_LENGTH = 2

/** The pause after the last key before the live search asks, in ms. */
export const SUGGEST_DELAY_MS = 200

/** Answers kept for the page's life: a word typed again, or a letter taken back, asks nothing. */
const KEPT = 30

/** The words a live search asks for: trimmed, runs of spaces as one; null below two characters. */
export function suggestWords(text: string): string | null {
  const words = text.trim().replace(/\s+/g, " ")
  return Array.from(words).length >= SUGGEST_MIN_LENGTH ? words : null
}

export type SuggestState =
  /** Too few characters: no panel. */
  | { status: "idle" }
  /** Waiting for the pause or the answer; the last answer stays on screen meanwhile. */
  | { status: "loading"; q: string; view: SearchSuggestView | null }
  | { status: "ready"; q: string; view: SearchSuggestView }
  /** The answer did not come: a quiet line, the form still submits. */
  | { status: "error"; q: string }

export const IDLE: SuggestState = { status: "idle" }

export interface Suggester {
  /** The field's text now: answered from what is kept, or asked after the pause. */
  ask: (text: string) => void
  /** Stops waiting and drops a request on its way (the field cleared, the page left). */
  cancel: () => void
}

type FetchView = (address: string, signal: AbortSignal) => Promise<SearchSuggestView>

const isView = (value: unknown): value is SearchSuggestView =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as SearchSuggestView).products) &&
  typeof (value as SearchSuggestView).allPath === "string"

/** The storefront's answer, or an error for anything but a 2xx JSON view. */
const fetchView: FetchView = async (address, signal) => {
  const response = await fetch(address, {
    signal,
    headers: { accept: "application/json" },
    credentials: "same-origin",
  })
  const body: unknown = response.ok ? await response.json() : null
  if (!isView(body)) {
    throw new Error(`live search answered ${String(response.status)}`)
  }
  return body
}

/**
 * One field's live search: `ask` on every change; the state comes back
 * through `onState`. Each change drops the request before it, so an
 * answer for words no longer in the field never shows.
 */
export function createSuggester({
  url,
  onState,
  delayMs = SUGGEST_DELAY_MS,
  load = fetchView,
}: {
  /** The storefront's live search address (`GET ?q=`). */
  url: string
  onState: (state: SuggestState) => void
  delayMs?: number
  load?: FetchView
}): Suggester {
  let timer: ReturnType<typeof setTimeout> | null = null
  let request: AbortController | null = null
  let shown: SearchSuggestView | null = null
  const kept = new Map<string, SearchSuggestView>()

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    request?.abort()
    request = null
  }

  const remember = (q: string, view: SearchSuggestView) => {
    kept.delete(q)
    kept.set(q, view)
    // A Map keeps insertion order: the oldest goes first
    for (const key of kept.keys()) {
      if (kept.size <= KEPT) {
        break
      }
      kept.delete(key)
    }
  }

  const send = (q: string) => {
    timer = null
    const own = new AbortController()
    request = own
    load(`${url}?${new URLSearchParams({ q }).toString()}`, own.signal).then(
      (view) => {
        if (own.signal.aborted) {
          return
        }
        request = null
        remember(q, view)
        shown = view
        onState({ status: "ready", q, view })
      },
      () => {
        if (own.signal.aborted) {
          return
        }
        request = null
        onState({ status: "error", q })
      }
    )
  }

  const ask = (text: string) => {
    cancel()
    const q = suggestWords(text)
    if (q === null) {
      shown = null
      onState(IDLE)
      return
    }
    const hit = kept.get(q)
    if (hit) {
      shown = hit
      onState({ status: "ready", q, view: hit })
      return
    }
    onState({ status: "loading", q, view: shown })
    timer = setTimeout(() => {
      send(q)
    }, delayMs)
  }

  return { ask, cancel }
}

/**
 * The arrow keys through `count` options: down from the field to the
 * first, up to the last; past either end back to the field (-1), where
 * the text is the shopper's again.
 */
export function moveActive(current: number, step: 1 | -1, count: number): number {
  if (count === 0) {
    return -1
  }
  if (current === -1) {
    return step === 1 ? 0 : count - 1
  }
  const next = current + step
  return next < 0 || next >= count ? -1 : next
}
