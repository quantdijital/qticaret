import {
  PUBLISH_AT,
  PUBLISH_FAILED,
  dueForPublish,
  hasSchedule,
  scheduleOf,
  scheduleProblem,
  withFailure,
  withSchedule,
  withoutSchedule,
} from "../publish-schedule"

const NOW = Date.parse("2026-11-28T07:00:00.000Z")

describe("planned publish (S2)", () => {
  describe("dueForPublish", () => {
    const draft = (id: string, at: unknown, status = "draft") => ({
      id,
      status,
      metadata: at === undefined ? {} : { [PUBLISH_AT]: at },
    })

    it("picks drafts whose moment has come, the longest waiting first", () => {
      const products = [
        draft("later", "2026-11-28T07:01:00.000Z"),
        draft("now", "2026-11-28T10:00:00+03:00"),
        draft("earlier", "2026-11-27T07:00:00.000Z"),
        draft("none", undefined),
      ]
      expect(dueForPublish(products, NOW).map((each) => each.id)).toEqual(["earlier", "now"])
    })

    it("leaves live products, unreadable moments and a missing metadata alone", () => {
      const products = [
        draft("live", "2026-11-27T07:00:00.000Z", "published"),
        draft("garbage", "yarın"),
        draft("number", 12),
        { id: "bare", status: "draft", metadata: null },
      ]
      expect(dueForPublish(products, NOW)).toEqual([])
    })
  })

  describe("the stored plan", () => {
    it("is written in UTC and read back, an earlier failure dropped", () => {
      const written = withSchedule(
        { other: 1, [PUBLISH_FAILED]: { at: "2026-11-01T00:00:00Z", reason: "x" } },
        "2026-11-28T10:00:00+03:00"
      )
      expect(written).toEqual({ other: 1, [PUBLISH_AT]: "2026-11-28T07:00:00.000Z" })
      expect(scheduleOf(written)).toEqual({ publish_at: "2026-11-28T07:00:00.000Z", failed: null })
    })

    it("is cleared with the other keys kept", () => {
      const cleared = withoutSchedule({ other: "a", [PUBLISH_AT]: "2026-11-28T07:00:00.000Z" })
      expect(cleared).toEqual({ other: "a" })
      expect(hasSchedule(cleared)).toBe(false)
      expect(hasSchedule({ [PUBLISH_AT]: "x" })).toBe(true)
      expect(hasSchedule(null)).toBe(false)
    })

    it("keeps a held publish's reason in place of the plan", () => {
      const failed = withFailure(
        { [PUBLISH_AT]: "2026-11-28T07:00:00.000Z" },
        { at: "2026-11-28T07:00:30.000Z", reason: "seo.publish_gate_blocked" }
      )
      expect(scheduleOf(failed)).toEqual({
        publish_at: null,
        failed: { at: "2026-11-28T07:00:30.000Z", reason: "seo.publish_gate_blocked" },
      })
      expect(scheduleOf({ [PUBLISH_FAILED]: "bozuk" }).failed).toBeNull()
    })
  })

  describe("scheduleProblem", () => {
    it("takes a moment ahead of now and within a year", () => {
      expect(scheduleProblem("2026-11-28T07:01:00Z", NOW)).toBeNull()
      expect(scheduleProblem("2026-11-28T07:00:00Z", NOW)).toBe("past")
      expect(scheduleProblem("2025-01-01T00:00:00Z", NOW)).toBe("past")
      expect(scheduleProblem("not a date", NOW)).toBe("past")
      expect(scheduleProblem("2027-12-30T00:00:00Z", NOW)).toBe("too_far")
    })
  })
})
