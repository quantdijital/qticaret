import { storefrontLink, SYSTEM_LINKS } from "../../../lib/storefront/menus"
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
