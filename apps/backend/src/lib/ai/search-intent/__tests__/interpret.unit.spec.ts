import { logger } from "../../../logging"
import { createSearchInterpreter } from "../interpret"
import type { InterpretRun } from "../interpret"
import type { SearchLists } from "../types"

/**
 * adr/0077 §7: the route's interpretation around the workflow. The same
 * sentence on the same day is read once (24 hours); whatever fails, the
 * sentence is searched as it is and nothing is kept; the log names a
 * reason, never the sentence.
 */

const LISTS: SearchLists = {
  today: "2027-06-10",
  booking: true,
  categories: [{ handle: "kultur-turlari", name: "Kültür turları" }],
  attributes: [],
}

const answered = (filter: InterpretRun["filter"]): InterpretRun => ({
  lists: LISTS,
  status: "succeeded",
  filter,
  dropped: [],
})

let clock = new Date("2027-06-10T09:00:00Z")
// The keyed hash needs the platform's key; the folded sentence stands in for it here
const plainKey = (folded: string) => folded
const interpreter = () => createSearchInterpreter({ now: () => clock, keyOf: plainKey })

beforeEach(() => {
  clock = new Date("2027-06-10T09:00:00Z")
  jest.restoreAllMocks()
})

describe("the search interpretation's cache and fallback", () => {
  it("reads the same sentence once a day, however it is typed", async () => {
    const interpret = interpreter()
    const run = jest.fn().mockResolvedValue(answered({ category: "kultur-turlari" }))
    const first = await interpret("Kültür turu", run)
    const again = await interpret("  kultur   TURU ", run)
    expect(run).toHaveBeenCalledTimes(1)
    expect(again).toEqual(first)
    expect(first.query).toBe("kategori=kultur-turlari")
    // Another day reads it again: "bu hafta sonu" is another range tomorrow
    clock = new Date("2027-06-11T09:00:00Z")
    await interpret("Kültür turu", run)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("forgets the sentence after 24 hours", async () => {
    const interpret = createSearchInterpreter({ now: () => clock, ttlMs: 1000, keyOf: plainKey })
    const run = jest.fn().mockResolvedValue(answered({ q: "balon" }))
    await interpret("balon", run)
    clock = new Date(clock.getTime() + 1001)
    await interpret("balon", run)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("searches the sentence as it is when the service fails, and keeps nothing", async () => {
    const interpret = interpreter()
    const run = jest
      .fn()
      .mockResolvedValueOnce({ lists: LISTS, status: "failed", filter: null, dropped: [] })
      .mockResolvedValueOnce(answered({ q: "balon" }))
    expect(await interpret("Kapadokya balon", run)).toEqual({
      query: "q=Kapadokya+balon",
      understood: [],
      dropped: [],
      fallback: true,
    })
    expect((await interpret("Kapadokya balon", run)).fallback).toBeUndefined()
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("falls back when the workflow refuses (no key, ceiling reached, flag off)", async () => {
    const interpret = interpreter()
    const info = jest.spyOn(logger, "info").mockImplementation(() => undefined)
    for (const key of ["ai.no_service", "ai.daily_limit_reached", "ai.feature_off"]) {
      const answer = await interpret("ağustosta iki kişi Kapadokya", () =>
        Promise.reject(new Error(key))
      )
      expect(answer).toMatchObject({ understood: [], fallback: true })
    }
    expect(info.mock.calls.map(([line]) => (line as unknown as { reason: string }).reason)).toEqual(
      ["ai.no_service", "ai.daily_limit_reached", "ai.feature_off"]
    )
  })

  it("writes no sentence to the log, whatever the error says", async () => {
    const interpret = interpreter()
    const info = jest.spyOn(logger, "info").mockImplementation(() => undefined)
    const text = "Kapadokya gizli cümle"
    await interpret(text, () => Promise.reject(new Error(`failed for ${text}`)))
    await interpret(text, () =>
      Promise.resolve({ lists: LISTS, status: "refused", filter: null, dropped: [] })
    )
    const logged = JSON.stringify(info.mock.calls)
    expect(logged).not.toContain("gizli")
    expect(info.mock.calls.map(([line]) => (line as unknown as { reason: string }).reason)).toEqual(
      ["error", "refused"]
    )
  })

  it("keys the cache by the sentence with personal data out, never as typed", async () => {
    const keyOf = jest.fn((folded: string) => `h:${String(folded.length)}`)
    const interpret = createSearchInterpreter({ now: () => clock, keyOf })
    const run = jest.fn().mockResolvedValue(answered({ q: "balon" }))
    await interpret("Balon 0532 123 45 67", run)
    await interpret("balon 0533 999 88 77", run)
    expect(keyOf.mock.calls.flat().join(" ")).not.toMatch(/053|Balon/)
    expect(run).toHaveBeenCalledTimes(1)
    // Only personal data: nothing to read, no call
    const only = await interpret("0532 123 45 67", run)
    expect(only.fallback).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("cuts a fallback to what the site search reads", async () => {
    const interpret = interpreter()
    const long = `${"kapadokya ".repeat(15)}son`
    const answer = await interpret(long, () => Promise.reject(new Error("ai.timeout")))
    const q = new URLSearchParams(answer.query).get("q") ?? ""
    expect(q.length).toBeLessThanOrEqual(100)
  })
})
