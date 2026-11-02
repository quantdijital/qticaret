import { describe, expect, it } from "vitest"
import {
  isAllowPath,
  isLongMaintenance,
  maintenanceBodyOf,
  maintenanceSchema,
  maintenanceValuesOf,
  normalizeAllowPath,
  toOffsetIso,
} from "./maintenance"

const DAY = 24 * 60 * 60_000

describe("the maintenance form's rules (backend sections/maintenance.ts)", () => {
  it("cleans a path as the server stores it", () => {
    expect(normalizeAllowPath(" /Blog/ ")).toBe("/blog")
    expect(normalizeAllowPath("/Sozlesmeler//*")).toBe("/sozlesmeler/*")
    expect(normalizeAllowPath("/")).toBe("/")
  })

  it("takes a shop path, exact or with what is below it, and nothing that leaves the shop", () => {
    for (const path of ["/iletisim", "/sozlesmeler/*", "/a/b-c_d"]) {
      expect(isAllowPath(path)).toBe(true)
    }
    for (const path of [
      "/*",
      "//evil.com",
      "iletisim",
      "/a?b",
      "/a#b",
      "/a/../b",
      "/a*b",
      "/a b",
    ]) {
      expect(isAllowPath(path)).toBe(false)
    }
    expect(isAllowPath(`/${"a".repeat(200)}`)).toBe(false)
  })

  it("writes a local time with its offset, and none for an empty or broken one", () => {
    const iso = toOffsetIso("2026-11-10T09:00")
    expect(iso).toMatch(/^2026-11-10T09:00:00[+-]\d\d:\d\d$/)
    expect(new Date(iso ?? "").getTime()).toBe(new Date(2026, 10, 10, 9, 0).getTime())
    expect(toOffsetIso("")).toBeNull()
    expect(toOffsetIso("yarın")).toBeNull()
  })

  it("warns of a shutdown longer than a few days", () => {
    const now = Date.UTC(2026, 10, 3)
    expect(isLongMaintenance(null, now)).toBe(false)
    expect(isLongMaintenance(new Date(now + 2 * DAY).toISOString(), now)).toBe(false)
    expect(isLongMaintenance(new Date(now + 4 * DAY).toISOString(), now)).toBe(true)
  })

  it("sends none for an empty field and each path once, round trip from the stored section", () => {
    const values = maintenanceValuesOf({
      enabled: true,
      title: null,
      message: "Bize {telefon} numarasından ulaşın.",
      expected_at: null,
      allow_paths: ["/iletisim"],
    })
    expect(values).toEqual({
      enabled: true,
      title: "",
      message: "Bize {telefon} numarasından ulaşın.",
      expected_at: "",
      allow_paths: [{ path: "/iletisim" }],
    })
    const parsed = maintenanceSchema.parse({
      ...values,
      allow_paths: [...values.allow_paths, { path: "/ILETISIM/" }, { path: "/x/*" }],
    })
    expect(maintenanceBodyOf(parsed)).toEqual({
      enabled: true,
      title: null,
      message: "Bize {telefon} numarasından ulaşın.",
      expected_at: null,
      allow_paths: ["/iletisim", "/x/*"],
    })
  })

  it("refuses an unknown shop detail, an empty path row and more than 20 paths", () => {
    const base = maintenanceValuesOf({
      enabled: false,
      title: null,
      message: null,
      expected_at: null,
      allow_paths: [],
    })
    expect(maintenanceSchema.safeParse({ ...base, message: "{kargo}" }).success).toBe(false)
    expect(maintenanceSchema.safeParse({ ...base, allow_paths: [{ path: " " }] }).success).toBe(
      false
    )
    const many = Array.from({ length: 21 }, (_, index) => ({ path: `/s${String(index)}` }))
    expect(maintenanceSchema.safeParse({ ...base, allow_paths: many }).success).toBe(false)
  })
})
