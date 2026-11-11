import { sectorPacks } from "@qticaret/sector-packs"
import type { SectorPack } from "@qticaret/sector-packs"
import { packArg } from "../../../scripts/apply-pack"
import { SectorPackInvalidError, checkedPack, packProblems } from "../check"

const PRODUCTION = { NODE_ENV: "production" } as NodeJS.ProcessEnv
const TEST = { NODE_ENV: "test" } as NodeJS.ProcessEnv

const pack = (extra: Partial<SectorPack> = {}): SectorPack => ({
  code: "deneme",
  version: 1,
  name: "Deneme",
  description: "Deneme paketi.",
  attribute_templates: [],
  categories: [],
  flags: [],
  seo: {},
  ...extra,
})

const template = (definition: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  handle: "sablon",
  name: "Şablon",
  definitions: [{ key: "alan", label: "Alan", type: "text", ...definition }],
  ...extra,
})

describe("every sector pack, checked with the shop's own schemas (adr/0061 C12)", () => {
  it.each(sectorPacks().map((each) => [each.code, each] as const))(
    "%s passes, in production and in tests",
    (_code, each) => {
      expect(packProblems(each, PRODUCTION)).toEqual([])
      expect(packProblems(each, TEST)).toEqual([])
      expect(checkedPack(each, PRODUCTION).attribute_templates).toHaveLength(
        each.attribute_templates.length
      )
    }
  )
})

describe("a pack the shop cannot take", () => {
  it.each([
    ["an unknown attribute field", template({ searchable: true })],
    ["an unknown template field", template({}, { icon: "bicak" })],
    ["a key that is no key", template({ key: "Namlu" })],
    ["a choice without options", template({ type: "select" })],
    ["a section the template lacks", template({ group: "namlu" })],
    [
      "a filterable choice named as a URL parameter",
      template({
        key: "fiyat",
        type: "select",
        is_filterable: true,
        options: [{ value: "a", label: "A" }],
      }),
    ],
  ])("refuses a template with %s", (_what, raw) => {
    const bad = pack({ attribute_templates: [raw] })
    expect(packProblems(bad, PRODUCTION).length).toBeGreaterThan(0)
    expect(() => checkedPack(bad, PRODUCTION)).toThrow(SectorPackInvalidError)
  })

  it("takes only the shop's own flags: a platform flag, an unknown one or a default are refused", () => {
    expect(
      packProblems(pack({ flags: [{ key: "test.platform_sample", enabled: false }] }), TEST)
    ).toEqual(["flag test.platform_sample: owned by the platform"])
    expect(packProblems(pack({ flags: [{ key: "catalog.yok", enabled: true }] }), TEST)).toEqual([
      "flag catalog.yok: unknown",
    ])
    expect(
      packProblems(pack({ flags: [{ key: "catalog.restricted", enabled: false }] }), TEST)
    ).toEqual(["flag catalog.restricted: is the default"])
    // A test-only flag is no flag of a released shop
    expect(
      packProblems(pack({ flags: [{ key: "test.sample", enabled: true }] }), PRODUCTION)
    ).toEqual(["flag test.sample: unknown"])
  })

  it("takes SEO templates only as the settings section does", () => {
    expect(
      packProblems(pack({ seo: { title_templates: { brand: "{marka} | {mağaza}" } } }), TEST)
    ).toEqual([])
    expect(
      packProblems(pack({ seo: { title_templates: { tag: "{etiket}" } } }), TEST).length
    ).toBeGreaterThan(0)
    expect(
      packProblems(pack({ seo: { title_templates: { brand: "{fiyat} | {mağaza}" } } }), TEST).length
    ).toBeGreaterThan(0)
    expect(
      packProblems(pack({ seo: { title_templates: { brand: "{marka" } } }), TEST).length
    ).toBeGreaterThan(0)
  })

  it("refuses a category name with a control character", () => {
    expect(packProblems(pack({ categories: [{ handle: "a", name: "A\u0007" }] }), TEST)).toEqual([
      "category a: text_invalid",
    ])
  })
})

describe("tenant:apply-pack pack=", () => {
  it("reads the pack's code and refuses anything else", () => {
    expect(packArg(["pack=cutlery"])).toBe("cutlery")
    for (const args of [[], ["pack="], ["pack=Bıçak"], ["pack=../general"], ["cutlery"]]) {
      expect(() => packArg(args)).toThrow("pack=<code> is required")
    }
  })
})
