import { MENU_LIMITS, storefrontLink, SYSTEM_LINKS } from "../../../lib/storefront/menus"
import { linkFromHref } from "../menu-hrefs"

/** A container whose address registry holds nothing (no record lives at these paths). */
const container = {
  resolve: () => ({ listUrlEntries: () => Promise.resolve([]) }),
} as unknown as Parameters<typeof linkFromHref>[0]

describe("storefront system links (adr/0049)", () => {
  it("names the category index, the brand index and the sale page", () => {
    expect(SYSTEM_LINKS).toEqual(expect.arrayContaining(["categories", "brands", "sale"]))
    for (const target of ["categories", "brands", "sale"]) {
      expect(storefrontLink.safeParse({ kind: "system", target, label: null }).success).toBe(true)
    }
    expect(
      storefrontLink.safeParse({ kind: "system", target: "campaigns", label: null }).success
    ).toBe(false)
  })

  it("reads the storefront's own pages, typed as addresses, as system links", async () => {
    const read = (href: string) => linkFromHref(container, { label: "Ad", href })
    await expect(read("/kategoriler")).resolves.toEqual({
      kind: "system",
      target: "categories",
      label: "Ad",
    })
    await expect(read("/markalar/")).resolves.toEqual({
      kind: "system",
      target: "brands",
      label: "Ad",
    })
    await expect(read("/kampanyalar?sirala=yeni")).resolves.toEqual({
      kind: "system",
      target: "sale",
      label: "Ad",
    })
    // Anything else stays the address it was
    await expect(read("/kampanyalar-arsivi")).resolves.toEqual({
      kind: "url",
      url: "/kampanyalar-arsivi",
      label: "Ad",
    })
  })
})

describe("an address as a link with no wording of its own", () => {
  it("is its own label, cut to the length the link's schema takes", async () => {
    const long = `https://ornek.com/${"rehber/".repeat(20)}`
    const link = await linkFromHref(container, { label: null, href: long })
    expect(link).toMatchObject({ kind: "url", url: long })
    expect(link.label).toHaveLength(MENU_LIMITS.label)
    expect(storefrontLink.safeParse(link).success).toBe(true)
    // A path nothing answers, too
    const path = await linkFromHref(container, { label: null, href: `/${"a".repeat(80)}` })
    expect(storefrontLink.safeParse(path).success).toBe(true)
    // A short one is kept whole
    await expect(
      linkFromHref(container, { label: null, href: "https://ornek.com/a" })
    ).resolves.toEqual({ kind: "url", url: "https://ornek.com/a", label: "https://ornek.com/a" })
  })
})
