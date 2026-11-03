import { describe, expect, it } from "vitest"
import { shownStatus } from "./link-state"

const NOW = new Date("2026-11-03T12:00:00Z").getTime()
const PAST = "2026-11-03T11:59:00Z"
const AHEAD = "2026-11-03T12:01:00Z"

describe("shownStatus (adr/0051 §12)", () => {
  it("reads a live link past its end as expired, before the expiry job writes it", () => {
    expect(shownStatus({ status: "open", expires_at: PAST }, NOW)).toBe("expired")
    // The job sweeps repriced links too
    expect(shownStatus({ status: "draft", expires_at: PAST }, NOW)).toBe("expired")
    // Its very end is no longer open, as the backend counts it
    expect(shownStatus({ status: "open", expires_at: "2026-11-03T12:00:00Z" }, NOW)).toBe("expired")
  })

  it("leaves a link within its time, and a closed one, as the backend says", () => {
    expect(shownStatus({ status: "open", expires_at: AHEAD }, NOW)).toBe("open")
    expect(shownStatus({ status: "draft", expires_at: AHEAD }, NOW)).toBe("draft")
    expect(shownStatus({ status: "paid", expires_at: PAST }, NOW)).toBe("paid")
    expect(shownStatus({ status: "canceled", expires_at: PAST }, NOW)).toBe("canceled")
    expect(shownStatus({ status: "expired", expires_at: AHEAD }, NOW)).toBe("expired")
  })
})
