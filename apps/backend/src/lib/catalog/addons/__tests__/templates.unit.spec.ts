import { kurus } from "../../../money"
import {
  AddonTemplateAddons,
  AddonTemplateIds,
  AddonTemplateName,
  addonCount,
  addonUnitPrice,
  byTemplateName,
  chooseAddons,
  effectiveAddons,
  growsPastLimit,
  hasForeignIds,
  storedAddonsOf,
  templateSourceOf,
  withinAddonLimit,
} from ".."
import type { AddonTemplateSource, StoredAddon } from ".."

const text = (id: string, price = 0, required = false): StoredAddon => ({
  id,
  kind: "text",
  label: `Yazı ${id}`,
  help: null,
  required,
  max_quantity: null,
  non_withdrawable: true,
  price,
  text: { max_length: 50, charset: "letters_digits" },
})

const template = (id: string, name: string, addons: StoredAddon[]): AddonTemplateSource => ({
  id,
  name,
  addons,
})

describe("add-on templates: effective add-ons (adr/0052 Ek 2026-11-23)", () => {
  it("puts the product's own first, then carried, then linked", () => {
    const merged = effectiveAddons({
      own: [text("ad_own")],
      carried: [template("adtpl_c", "Kılıf", [text("ad_c")])],
      linked: [template("adtpl_l", "Kazıma", [text("ad_l")])],
    })
    expect(merged.addons.map((addon) => addon.id)).toEqual(["ad_own", "ad_c", "ad_l"])
    expect(merged.templates.map((each) => [each.id, each.via])).toEqual([
      ["adtpl_c", "attribute_template"],
      ["adtpl_l", "product"],
    ])
    expect(merged.hidden).toBe(0)
  })

  it("counts a template reached twice once, as carried", () => {
    const shared = template("adtpl_1", "Kazıma", [text("ad_1"), text("ad_2")])
    const merged = effectiveAddons({ own: [], carried: [shared], linked: [shared] })
    expect(merged.addons.map((addon) => addon.id)).toEqual(["ad_1", "ad_2"])
    expect(merged.templates).toHaveLength(1)
    expect(merged.templates[0]?.via).toBe("attribute_template")
  })

  it("keeps ids as stored, so cart lines still name them", () => {
    const merged = effectiveAddons({
      own: [],
      carried: [],
      linked: [template("adtpl_1", "A", [text("ad_keep")])],
    })
    expect(merged.addons[0]?.id).toBe("ad_keep")
  })

  it("leaves out an add-on id seen already", () => {
    const merged = effectiveAddons({
      own: [text("ad_1")],
      carried: [],
      linked: [template("adtpl_1", "A", [text("ad_1"), text("ad_2")])],
    })
    expect(merged.addons.map((addon) => addon.id)).toEqual(["ad_1", "ad_2"])
  })

  it("shows five at most, own first, and says how many are hidden", () => {
    const sources = {
      own: [text("o1"), text("o2"), text("o3")],
      carried: [template("adtpl_c", "C", [text("c1"), text("c2")])],
      linked: [template("adtpl_l", "L", [text("l1")])],
    }
    const merged = effectiveAddons(sources)
    expect(merged.addons.map((addon) => addon.id)).toEqual(["o1", "o2", "o3", "c1", "c2"])
    expect(merged.hidden).toBe(1)
    expect(addonCount(sources)).toBe(6)
    expect(withinAddonLimit(sources)).toBe(false)
    expect(withinAddonLimit({ ...sources, linked: [] })).toBe(true)
  })

  it("orders linked templates by name, Turkish letters as Turkish", () => {
    const names = [
      template("b", "Şerit", []),
      template("a", "Çanta", []),
      template("c", "Kazıma", []),
    ].sort(byTemplateName)
    expect(names.map((each) => each.name)).toEqual(["Çanta", "Kazıma", "Şerit"])
  })

  it("reads a stored row; anything else is none", () => {
    expect(
      templateSourceOf({ id: "adtpl_1", name: "A", addons: { items: [text("ad_1")] } })
    ).toEqual(template("adtpl_1", "A", [text("ad_1")]))
    expect(templateSourceOf({ id: "adtpl_1", name: "A", addons: "x" }).addons).toEqual([])
  })

  it("prices a template's add-on as an own one: the same server-side sum", () => {
    const merged = effectiveAddons({
      own: [],
      carried: [],
      linked: [template("adtpl_1", "Kazıma", [text("ad_1", 150)])],
    })
    const result = chooseAddons(merged.addons, [{ addon_id: "ad_1", value: "Ahmet" }])
    if (!("chosen" in result)) {
      throw new Error("expected a choice")
    }
    expect(result.chosen[0]?.amount).toBe(150)
    expect(addonUnitPrice(kurus(100_000), result.chosen)).toBe(115_000)
  })
})

describe("add-on templates: input", () => {
  it("takes a plain name of up to 60 characters", () => {
    expect(AddonTemplateName.safeParse("  Bıçağa isim kazıma ").data).toBe("Bıçağa isim kazıma")
    expect(AddonTemplateName.safeParse("").success).toBe(false)
    expect(AddonTemplateName.safeParse("x".repeat(61)).success).toBe(false)
  })

  it("keeps a product's rules, none allowed while it is new", () => {
    const engraving = { kind: "text", label: "Kazıma", price: 150 }
    expect(AddonTemplateAddons.safeParse([engraving]).success).toBe(true)
    // Made by its name first, filled on its page
    expect(AddonTemplateAddons.safeParse([]).success).toBe(true)
    const paidRequired = AddonTemplateAddons.safeParse([{ ...engraving, required: true }])
    expect(paidRequired.error?.issues[0]?.message).toBe("addons.required_must_be_free")
    expect(AddonTemplateAddons.safeParse(Array.from({ length: 6 }, () => engraving)).success).toBe(
      false
    )
  })

  it("takes each template id once", () => {
    expect(AddonTemplateIds.safeParse(["adtpl_1", "adtpl_2"]).success).toBe(true)
    expect(AddonTemplateIds.safeParse(["adtpl_1", "adtpl_1"]).success).toBe(false)
    expect(AddonTemplateIds.safeParse([]).success).toBe(true)
  })
})

describe("add-on templates: the limit counted merged, and ids the server gave", () => {
  it("refuses a change that grows a product past five, even with the template's list as long", () => {
    const before = {
      own: [text("o1"), text("o2"), text("o3"), text("o4")],
      carried: [],
      linked: [template("adtpl_1", "A", [text("o1")])],
    }
    // Same list length, but the template's add-on no longer repeats an own one
    const after = { ...before, linked: [template("adtpl_1", "A", [text("t1")])] }
    expect(growsPastLimit(before, before)).toBe(false)
    expect(growsPastLimit(before, after)).toBe(false)
    const full = { ...before, own: [...before.own, text("o5")] }
    expect(
      growsPastLimit(full, { ...full, linked: [template("adtpl_1", "A", [text("t1")])] })
    ).toBe(true)
    // One already past five may shrink or stay
    const over = { ...full, linked: [template("adtpl_1", "A", [text("t1"), text("t2")])] }
    expect(growsPastLimit(over, { ...over, own: over.own.slice(1) })).toBe(false)
  })

  it("refuses an add-on or choice id the template never had", () => {
    const stored: StoredAddon[] = [
      text("ad_1"),
      {
        ...text("ad_2"),
        kind: "choice",
        choices: [{ id: "ch_1", label: "A", price: 1 }],
      } as unknown as StoredAddon,
    ]
    expect(hasForeignIds([{ id: "ad_1", kind: "text" }, { kind: "text" }], stored)).toBe(false)
    expect(hasForeignIds([{ id: "ad_x", kind: "text" }], stored)).toBe(true)
    expect(
      hasForeignIds([{ id: "ad_2", kind: "choice", choices: [{ id: "ch_1" }, {}] }], stored)
    ).toBe(false)
    expect(hasForeignIds([{ id: "ad_2", kind: "choice", choices: [{ id: "ch_x" }] }], stored)).toBe(
      true
    )
    expect(hasForeignIds([{ kind: "choice", choices: [{ id: "ch_1" }] }], stored)).toBe(true)
    expect(hasForeignIds([{ id: "ad_1", kind: "text" }], [])).toBe(true)
  })

  it("reads a stored price outside the bounds as no add-ons", () => {
    expect(storedAddonsOf({ items: [text("ad_1", 10)] })).toHaveLength(1)
    expect(storedAddonsOf({ items: [text("ad_1", -1)] })).toEqual([])
    expect(storedAddonsOf({ items: [text("ad_1", 10_001)] })).toEqual([])
  })
})
