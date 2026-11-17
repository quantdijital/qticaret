import { layoutDocument } from "../layout"
import { printedNewsletter } from "../sections/newsletter"

/**
 * The footer box's band on the free rows footer's ground (adr/0070 §4 Ek):
 * a setting of the footer box's bands alone, printed only when on, so a box
 * saved before it reads and prints as it did.
 */

const box = (more: Record<string, unknown> = {}) => ({
  id: "altbulten1",
  type: "newsletter",
  title: null,
  text: null,
  ...more,
})
const parses = (doc: Record<string, unknown>) => layoutDocument.safeParse(doc).success
const same = (text: string | null) => text
const asIs = (url: string, alt: string | null) => ({ url, alt })

describe("the footer box's joined band", () => {
  it("takes the setting on the footer's bands and prints it only when on", () => {
    for (const variant of ["split", "image_card", "strip"]) {
      const doc = layoutDocument.parse({ footer: [box({ variant, joined: true })] })
      expect(printedNewsletter(doc.footer[0] as never, same, asIs)).toMatchObject({
        variant,
        joined: true,
      })
    }
    const off = layoutDocument.parse({ footer: [box({ variant: "split", joined: false })] })
    expect(printedNewsletter(off.footer[0] as never, same, asIs)).not.toHaveProperty("joined")
    const before = layoutDocument.parse({ footer: [box({ variant: "split" })] })
    expect(before.footer[0]).not.toHaveProperty("joined")
    expect(printedNewsletter(before.footer[0] as never, same, asIs)).not.toHaveProperty("joined")
  })

  it("refuses it where it means nothing: the footer's standard and column boxes, a page's box", () => {
    expect(parses({ footer: [box({ variant: "standard", joined: true })] })).toBe(false)
    expect(parses({ footer: [box({ variant: "in_footer", joined: true })] })).toBe(false)
    expect(parses({ home: [box({ variant: "split", joined: true })] })).toBe(false)
    expect(parses({ footer: [box({ variant: "split", joined: "evet" })] })).toBe(false)
  })
})
