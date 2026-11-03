import { SECTIONS, isSectionName } from "../sections"
import { mergePatch } from "../sections/define"

const { full, patch, defaults } = SECTIONS.payment_links

const saved = (body: Record<string, unknown>) => full.safeParse(mergePatch(defaults, body))

/** adr/0051: how far an admin may discount a link, and whether its order is paid at the door. */
describe("payment_links section", () => {
  it("starts at a fifth for an admin and no cash on delivery, and passes its own checks", () => {
    expect(isSectionName("payment_links")).toBe(true)
    expect(defaults).toEqual({ admin_max_discount_percent: 20, allow_cod: false })
    expect(full.safeParse(defaults).success).toBe(true)
  })

  it("takes a whole percent from 0 to 99 for an admin", () => {
    expect(saved({ admin_max_discount_percent: 0 }).success).toBe(true)
    expect(saved({ admin_max_discount_percent: 99 }).success).toBe(true)
    expect(saved({ admin_max_discount_percent: 100 }).success).toBe(false)
    expect(saved({ admin_max_discount_percent: -1 }).success).toBe(false)
    expect(saved({ admin_max_discount_percent: 12.5 }).success).toBe(false)
  })

  it("takes cash on delivery as a yes or no, any subset of fields, and no unknown one", () => {
    expect(saved({ allow_cod: true }).success).toBe(true)
    expect(saved({ allow_cod: "true" }).success).toBe(false)
    expect(patch.safeParse({ allow_cod: true }).success).toBe(true)
    expect(patch.safeParse({ owner_max_discount_percent: 100 }).success).toBe(false)
  })
})
