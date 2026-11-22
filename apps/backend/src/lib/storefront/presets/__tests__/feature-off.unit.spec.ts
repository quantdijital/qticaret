import { resolvePreset } from "../resolve"
import type { PresetLookups } from "../resolve"

const SCHEDULE = { visible: true, starts_at: null, ends_at: null }

const lookups: PresetLookups = {
  records: new Map(),
  links: new Map(),
  images: new Map([["images/kapak.webp", "http://localhost:9000/static/kapak.webp"]]),
}

// No section needs a flag yet (adr/0077 §10): a real type stands in for one
const faq = {
  id: "sorular",
  type: "faq",
  ...SCHEDULE,
  title: null,
  items: [],
}
const banner = {
  id: "afis",
  type: "banner",
  ...SCHEDULE,
  image: { $image: "images/kapak.webp", alt: "Kapak" },
}

describe("a preset's section whose feature flag is off (adr/0077 §8)", () => {
  it("is dropped, named in the report with its type and flag, its images not brought in", () => {
    const resolved = resolvePreset(
      {
        home: [faq, banner],
        pages: [],
      },
      null,
      { ...lookups, types_off: new Map([["banner", "catalog.booking"]]) }
    )

    expect(resolved.groups.home).toEqual([faq])
    expect(resolved.dropped).toEqual(["home.afis"])
    expect(resolved.skipped).toEqual([
      { where: "home.afis", ref: "banner", reason: "feature_off", flag: "catalog.booking" },
    ])
    expect(resolved.images).toEqual([])
  })

  it("keeps every section while no type is off", () => {
    const resolved = resolvePreset({ home: [faq] }, null, {
      ...lookups,
      types_off: new Map(),
    })

    expect(resolved.groups.home).toEqual([faq])
    expect(resolved.dropped).toEqual([])
    expect(resolved.skipped).toEqual([])
  })
})
