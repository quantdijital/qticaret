import { describe, expect, it } from "vitest"
import {
  formatPublishAt,
  publishFieldValue,
  publishScheduleOf,
  readPublishAt,
} from "@/features/products/publish-schedule"

const NOW = Date.parse("2026-11-26T09:00:00.000Z")

describe("planned publish (S2)", () => {
  it("reads a draft's plan and failure from its metadata", () => {
    expect(
      publishScheduleOf({ status: "draft", metadata: { publish_at: "2026-11-28T07:00:00.000Z" } })
    ).toEqual({ publish_at: "2026-11-28T07:00:00.000Z", failed: null })
    expect(
      publishScheduleOf({
        status: "draft",
        metadata: { publish_failed: { at: "2026-11-28T07:00:00.000Z", reason: "x" } },
      }).failed
    ).toEqual({ at: "2026-11-28T07:00:00.000Z", reason: "x" })
  })

  it("reads none for a live product, garbage or no metadata", () => {
    const none = { publish_at: null, failed: null }
    expect(
      publishScheduleOf({ status: "published", metadata: { publish_at: "2026-11-28T07:00:00Z" } })
    ).toEqual(none)
    expect(publishScheduleOf({ status: "draft", metadata: { publish_at: "yarın" } })).toEqual(none)
    expect(publishScheduleOf({ status: "draft", metadata: null })).toEqual(none)
    expect(publishScheduleOf(undefined)).toEqual(none)
  })

  it("takes the typed moment as Türkiye's clock, ahead of now and within a year", () => {
    expect(readPublishAt("2026-11-28T10:00", NOW)).toEqual({
      at: "2026-11-28T10:00:00+03:00",
      problem: null,
    })
    expect(readPublishAt("", NOW).problem).toBe("required")
    expect(readPublishAt("2026-11-26T11:00", NOW).problem).toBe("past")
    expect(readPublishAt("2028-01-01T10:00", NOW).problem).toBe("tooFar")
  })

  it("starts the field at the plan, or tomorrow 10:00", () => {
    expect(publishFieldValue("2026-11-28T07:00:00.000Z", NOW)).toBe("2026-11-28T10:00")
    expect(publishFieldValue(null, NOW)).toBe("2026-11-27T10:00")
  })

  it("shows the plan in short for the list's badge", () => {
    expect(formatPublishAt("2026-11-28T07:00:00.000Z")).toBe("28 Kas 10:00")
  })
})
