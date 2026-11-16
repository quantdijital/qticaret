import { SYSTEM_LINKS } from "../../../lib/storefront/menus"
import { DEMO_TOP_LINKS } from "../data"
import { demoTopLinksPlan } from "../storefront"

describe("the demo's top links (seed:demo)", () => {
  it("makes the menu when the shop has none: the storefront's own pages only", () => {
    const plan = demoTopLinksPlan(null)
    expect(plan).toEqual({
      title: "Üst bağlantılar",
      location: "top",
      rank: 0,
      items: DEMO_TOP_LINKS.links.map((link) => ({ link, children: [] })),
    })
    expect(plan).not.toHaveProperty("id")
    // Pages every shop has: no record, content page or legal text a demo may lack
    for (const { link } of plan?.items ?? []) {
      expect(link.kind).toBe("system")
      expect(SYSTEM_LINKS).toContain("target" in link ? link.target : null)
    }
    expect(plan?.items.map(({ link }) => ("target" in link ? link.target : null))).toEqual([
      "order_lookup",
      "sale",
      "reviews",
    ])
  })

  it("fills an empty menu the shop has, its title kept", () => {
    const plan = demoTopLinksPlan({ id: "smenu_1", title: "Kurumsal", links: 0 })
    expect(plan).toMatchObject({ id: "smenu_1", title: "Kurumsal", location: "top" })
    expect(plan?.items).toHaveLength(3)
  })

  it("leaves a menu with links of its own alone, so a rerun doubles nothing", () => {
    expect(demoTopLinksPlan({ id: "smenu_1", title: "Üst bağlantılar", links: 3 })).toBeNull()
    expect(demoTopLinksPlan({ id: "smenu_1", title: "Kurumsal", links: 1 })).toBeNull()
  })
})
