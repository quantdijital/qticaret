import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SearchSuggestView } from "../listing-views"
import { createSuggester, moveActive, suggestWords } from "../search-suggest"
import type { SuggestState } from "../search-suggest"

const view = (q: string): SearchSuggestView => ({
  q,
  total: 1,
  allPath: `/arama?q=${encodeURIComponent(q)}`,
  products: [
    { id: "prod_1", title: "Katlanır Çakı", path: "/urun/caki", image: null, price: null },
  ],
  categories: [],
  brands: [],
  suggestions: [],
})

/** A suggester whose loads wait until the test answers them; every state it said. */
function harness() {
  const states: SuggestState[] = []
  const loads: {
    address: string
    signal: AbortSignal
    answer: (v: SearchSuggestView) => void
    fail: () => void
  }[] = []
  const suggester = createSuggester({
    url: "/api/search/suggest",
    onState: (state) => states.push(state),
    load: (address, signal) =>
      new Promise<SearchSuggestView>((resolve, reject) => {
        loads.push({
          address,
          signal,
          answer: resolve,
          fail: () => {
            reject(new Error("502"))
          },
        })
      }),
  })
  return { suggester, states, loads }
}

describe("live search in the browser", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("asks from two characters, runs of spaces as one", () => {
    expect(suggestWords(" ç ")).toBeNull()
    expect(suggestWords("ça")).toBe("ça")
    expect(suggestWords("  kemik   saplı ")).toBe("kemik saplı")
  })

  it("waits for the pause after the last key, then asks once for the words in the field", async () => {
    const { suggester, states, loads } = harness()
    suggester.ask("ça")
    suggester.ask("çak")
    suggester.ask("çakı")
    vi.advanceTimersByTime(199)
    expect(loads).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(loads.map((each) => each.address)).toEqual(["/api/search/suggest?q=%C3%A7ak%C4%B1"])
    expect(states.at(-1)).toEqual({ status: "loading", q: "çakı", view: null })
    loads[0]?.answer(view("çakı"))
    await vi.runAllTimersAsync()
    expect(states.at(-1)).toEqual({ status: "ready", q: "çakı", view: view("çakı") })
  })

  it("drops the request before a change, so a stale answer never shows", async () => {
    const { suggester, states, loads } = harness()
    suggester.ask("ça")
    vi.advanceTimersByTime(200)
    suggester.ask("çakı")
    expect(loads[0]?.signal.aborted).toBe(true)
    loads[0]?.answer(view("ça"))
    vi.advanceTimersByTime(200)
    loads[1]?.answer(view("çakı"))
    await vi.runAllTimersAsync()
    const ready = states.filter((state) => state.status === "ready")
    expect(ready).toEqual([{ status: "ready", q: "çakı", view: view("çakı") }])
  })

  it("keeps the last answer on screen while the next loads, and answers a kept word at once", async () => {
    const { suggester, states, loads } = harness()
    suggester.ask("çakı")
    vi.advanceTimersByTime(200)
    loads[0]?.answer(view("çakı"))
    await vi.runAllTimersAsync()
    suggester.ask("çakıl")
    expect(states.at(-1)).toEqual({ status: "loading", q: "çakıl", view: view("çakı") })
    // A letter taken back: the kept answer, no request
    suggester.ask("çakı ")
    expect(states.at(-1)).toEqual({ status: "ready", q: "çakı", view: view("çakı") })
    vi.advanceTimersByTime(1000)
    expect(loads).toHaveLength(1)
  })

  it("says a failure once, quietly; fewer than two characters close the panel", async () => {
    const { suggester, states, loads } = harness()
    suggester.ask("zz")
    vi.advanceTimersByTime(200)
    loads[0]?.fail()
    await vi.runAllTimersAsync()
    expect(states.at(-1)).toEqual({ status: "error", q: "zz" })
    suggester.ask("z")
    expect(states.at(-1)).toEqual({ status: "idle" })
    suggester.ask("zzz")
    suggester.cancel()
    vi.advanceTimersByTime(1000)
    expect(loads).toHaveLength(1)
  })

  it("moves the arrow keys through the options and back to the field past either end", () => {
    expect(moveActive(-1, 1, 3)).toBe(0)
    expect(moveActive(0, 1, 3)).toBe(1)
    expect(moveActive(2, 1, 3)).toBe(-1)
    expect(moveActive(-1, -1, 3)).toBe(2)
    expect(moveActive(0, -1, 3)).toBe(-1)
    expect(moveActive(-1, 1, 0)).toBe(-1)
  })
})
