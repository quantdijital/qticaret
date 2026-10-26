import { describe, expect, it } from "vitest"
import type { PriceList } from "./api/price-lists"
import { GROUPS_RULE, bodyOf, percentOf, percentOff, priceListSchema, valuesOf } from "./form"

const list = (fields: Partial<PriceList>): PriceList =>
  ({
    id: "plist_1",
    title: "Yaz",
    description: "",
    type: "sale",
    status: "active",
    starts_at: null,
    ends_at: null,
    rules: {},
    ...fields,
  }) as PriceList

const errorsOf = (values: ReturnType<typeof valuesOf>) => {
  const parsed = priceListSchema.safeParse(values)
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
}

describe("valuesOf", () => {
  it("starts a new list as a sale for everyone, on", () => {
    expect(valuesOf(null)).toEqual({
      title: "",
      description: "",
      type: "sale",
      active: true,
      starts: "",
      ends: "",
      audience: "everyone",
      groups: [],
    })
  })

  it("reads a list's days in Turkey and its customer groups", () => {
    const values = valuesOf(
      list({
        type: "override",
        status: "draft",
        // 21:00 UTC is already the next day in Turkey
        starts_at: "2026-10-31T21:00:00.000Z",
        ends_at: "2026-11-30T20:59:59.000Z",
        rules: { [GROUPS_RULE]: ["cusgroup_1"] },
      })
    )
    expect(values).toMatchObject({
      type: "override",
      active: false,
      starts: "2026-11-01",
      ends: "2026-11-30",
      audience: "groups",
      groups: ["cusgroup_1"],
    })
  })
})

describe("bodyOf", () => {
  it("sends whole days and no group rule for everyone", () => {
    const body = bodyOf({
      ...valuesOf(null),
      title: " Yaz ",
      starts: "2026-11-01",
      ends: "2026-11-30",
    })
    expect(body).toEqual({
      title: "Yaz",
      description: "",
      type: "sale",
      status: "active",
      starts_at: "2026-10-31T21:00:00.000Z",
      ends_at: "2026-11-30T20:59:59.000Z",
      rules: {},
    })
  })

  it("prices only the chosen groups, and a list left off is a draft", () => {
    const body = bodyOf({
      ...valuesOf(null),
      title: "Bayi",
      active: false,
      audience: "groups",
      groups: ["cusgroup_1"],
    })
    expect(body).toMatchObject({ status: "draft", rules: { [GROUPS_RULE]: ["cusgroup_1"] } })
  })

  it("leaves a saved list's status, untouched days and other rules as they are", () => {
    const saved = list({
      ends_at: "2026-11-30T12:00:00.000Z",
      rules: { [GROUPS_RULE]: ["cusgroup_1"], "region.id": ["reg_1"] },
    })
    const values = { ...valuesOf(saved), title: "Yaz sonu", audience: "everyone" as const }
    const body = bodyOf(values, saved, false)
    expect(body).not.toHaveProperty("status")
    expect(body).not.toHaveProperty("ends_at")
    expect(body.rules).toEqual({ "region.id": ["reg_1"] })
    expect(bodyOf(values, saved, true)).toMatchObject({ ends_at: "2026-11-30T20:59:59.000Z" })
  })
})

describe("priceListSchema", () => {
  it("asks for a title, days in order and a group when it is for groups", () => {
    expect(errorsOf(valuesOf(null))).toEqual(["priceLists.errors.title"])
    expect(
      errorsOf({ ...valuesOf(null), title: "Yaz", starts: "2026-11-02", ends: "2026-11-01" })
    ).toEqual(["priceLists.errors.dates"])
    expect(errorsOf({ ...valuesOf(null), title: "Bayi", audience: "groups" })).toEqual([
      "priceLists.errors.groups",
    ])
  })
})

describe("percentOff", () => {
  it.each([
    ["100.00", "80.00", 20],
    ["33.33", "28.33", 15],
    ["100.00", "100.00", null],
    ["100.00", "120.00", null],
    [null, "80.00", null],
  ])("%s → %s is %s percent off", (base, price, expected) => {
    expect(percentOff(base, price)).toBe(expected)
  })
})

describe("percentOf", () => {
  it.each([
    ["20", 20],
    ["12,5", 12.5],
    ["99", 99],
    ["0", null],
    ["99,5", null],
    ["12,345", null],
    ["", null],
  ])("%s is %s", (text, expected) => {
    expect(percentOf(text)).toBe(expected)
  })
})
