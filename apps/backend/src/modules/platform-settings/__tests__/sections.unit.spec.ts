import { featureDefinition, featureRegistry } from "../features"
import { logger } from "../../../lib/logging"
import { SECTIONS, isSectionName, mergePatch } from "../sections"
import { parseStored } from "../sections/stored"

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? []

describe("store section", () => {
  const { full, patch, defaults } = SECTIONS.store

  it("starts from Turkish defaults", () => {
    expect(full.parse(defaults)).toEqual({
      contact_email: null,
      contact_phone: null,
      timezone: "Europe/Istanbul",
      weight_unit: "g",
      dimension_unit: "cm",
    })
  })

  it("normalises a Turkish phone number", () => {
    expect(full.parse({ ...defaults, contact_phone: "0532 123 45 67" }).contact_phone).toBe(
      "+905321234567"
    )
  })

  it.each([
    [{ contact_phone: "12" }, "platform_settings.phone_invalid"],
    [{ contact_email: "not-an-email" }, "platform_settings.email_invalid"],
    [{ timezone: "Mars/Olympus" }, "platform_settings.timezone_invalid"],
  ])("refuses %p", (values, message) => {
    expect(messages(full.safeParse({ ...defaults, ...values }))).toContain(message)
  })

  it("takes any subset of fields and refuses unknown ones", () => {
    expect(patch.safeParse({ weight_unit: "kg" }).success).toBe(true)
    expect(patch.safeParse({ api_secret: "x" }).success).toBe(false)
  })
})

describe("seo section", () => {
  const { full, patch, defaults } = SECTIONS.seo

  it("ships docs/13 defaults that pass its own checks", () => {
    expect(full.safeParse(defaults).success).toBe(true)
  })

  it.each([
    [
      "an unknown template token",
      { title_templates: { ...defaults.title_templates, product: "{fiyat} | {mağaza}" } },
      "seo.template_invalid",
    ],
    [
      "a category token in a brand template",
      { title_templates: { ...defaults.title_templates, brand: "{kategori}" } },
      "seo.template_invalid",
    ],
    [
      "a host with a scheme",
      { canonical_host: "https://shop.example" },
      "platform_settings.host_invalid",
    ],
    ["a host without a dot", { canonical_host: "localhost" }, "platform_settings.host_invalid"],
    [
      "a robots line that is not a directive",
      { robots_txt: "User-agent: *\n<script>" },
      "platform_settings.robots_invalid",
    ],
    [
      "a NUL in a template",
      { title_templates: { ...defaults.title_templates, product: "{ürün_adı}\u0000" } },
      "platform_settings.text_invalid",
    ],
    [
      "a lone surrogate in a template",
      { description_templates: { product: "{kısa_açıklama} \ud800" } },
      "platform_settings.text_invalid",
    ],
    [
      "a C1 control character in robots",
      { robots_txt: "# yorum \u0085" },
      "platform_settings.robots_invalid",
    ],
    [
      "a control character in robots",
      { robots_txt: "Disallow: /a\u0007" },
      "platform_settings.robots_invalid",
    ],
    [
      "the facet lines' place in other letters (it would print as it is)",
      { robots_txt: "User-agent: *\n{FACET_DISALLOW}" },
      "platform_settings.robots_invalid",
    ],
  ])("refuses %s", (_label, values, message) => {
    expect(messages(full.safeParse({ ...defaults, ...values }))).toContain(message)
  })

  it("takes the facet lines' place, as the default does", () => {
    expect(
      full.safeParse({ ...defaults, robots_txt: "User-agent: *\n{facet_disallow}" }).success
    ).toBe(true)
    expect(defaults.robots_txt).toContain("\n{facet_disallow}\n")
  })

  it("lower-cases the canonical host", () => {
    expect(full.parse({ ...defaults, canonical_host: " Shop.Example.COM " }).canonical_host).toBe(
      "shop.example.com"
    )
  })

  it("accepts part of a nested object in a patch, and merges it over the current values", () => {
    const sent = patch.parse({ title_templates: { brand: "{marka} | {mağaza}" } })
    const merged = mergePatch(defaults, sent)

    expect(full.parse(merged).title_templates).toEqual({
      ...defaults.title_templates,
      brand: "{marka} | {mağaza}",
    })
  })
})

describe("section names and feature flags", () => {
  it("knows its sections and nothing from the prototype", () => {
    expect(isSectionName("seo")).toBe(true)
    expect(isSectionName("toString")).toBe(false)
    expect(isSectionName("__proto__")).toBe(false)
  })

  it("has test flags only under NODE_ENV=test", () => {
    expect(Object.keys(featureRegistry({ NODE_ENV: "test" }))).toContain("test.sample")
    expect(Object.keys(featureRegistry({ NODE_ENV: "production" }))).not.toContain("test.sample")
  })

  it("looks flags up by own key only", () => {
    expect(featureDefinition("test.sample", { NODE_ENV: "test" })).toMatchObject({
      owner: "tenant",
    })
    expect(featureDefinition("constructor", { NODE_ENV: "test" })).toBeUndefined()
  })
})

describe("parseStored", () => {
  beforeEach(() => {
    jest.spyOn(logger, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("drops fields the schema no longer knows", () => {
    expect(parseStored("store", { weight_unit: "kg", removed_field: "x" })).toEqual({
      ...SECTIONS.store.defaults,
      weight_unit: "kg",
    })
  })

  it("falls back field by field when one stored field no longer passes", () => {
    const values = parseStored("seo", {
      canonical_host: "shop.example.com",
      title_templates: { product: "{eski_token}", category: "x", brand: "y" },
    })

    expect(values["canonical_host"]).toBe("shop.example.com")
    expect(values["title_templates"]).toEqual(SECTIONS.seo.defaults.title_templates)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "platform_settings.section_invalid",
        fields: ["title_templates"],
      })
    )
  })
})
