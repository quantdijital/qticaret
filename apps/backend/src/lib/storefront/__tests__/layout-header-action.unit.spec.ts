import { headerLinked, linksOf } from "../../../workflows/storefront/layout-check"
import { layoutDocument } from "../layout"
import { mainSectionsOf, withMainSections } from "../layout-main"

/**
 * Every header's action button: the catalog header's highlighted link
 * (`highlight_link`, same name and meaning), now on the standard and
 * centred headers too. Absent until written there, so a bar saved before
 * it reads, stores and prints as it did.
 */

const LEFT = { layout: "left", sticky: true } as const
const bar = (variant: string, more: Record<string, unknown> = {}) => ({
  id: "mainheader",
  type: "header_bar",
  variant,
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

const BOOK = { kind: "url", url: "https://example.com/rezervasyon", label: "Rezervasyon" } as const

describe("the header's action button on every variant", () => {
  it("is absent on a bar saved before it, and kept as written", () => {
    for (const variant of ["standard", "centered"]) {
      const plain = layoutDocument.parse({ header: [bar(variant)] })
      expect(plain.header[0]).not.toHaveProperty("highlight_link")
      const set = layoutDocument.parse({ header: [bar(variant, { highlight_link: BOOK })] })
      expect(set.header[0]).toMatchObject({ highlight_link: BOOK })
      const cleared = layoutDocument.parse({ header: [bar(variant, { highlight_link: null })] })
      expect(cleared.header[0]).toMatchObject({ highlight_link: null })
    }
  })

  it("is held to the same link rules as the catalog's", () => {
    const unsafe = { kind: "url", url: "javascript:alert(1)", label: "x" }
    expect(issues({ header: [bar("standard", { highlight_link: unsafe })] })).not.toEqual([])
    expect(issues({ header: [bar("catalog", { highlight_link: unsafe })] })).not.toEqual([])
    expect(issues({ header: [bar("centered", { highlight_link: "/x" })] })).not.toEqual([])
  })

  it("is named for the save's checks and the reading", () => {
    const doc = layoutDocument.parse({ header: [bar("centered", { highlight_link: BOOK })] })
    expect(headerLinked(doc).flatMap(linksOf)).toEqual([BOOK])
    expect(
      headerLinked(layoutDocument.parse({ header: [bar("standard")] })).flatMap(linksOf)
    ).toEqual([])
  })

  it("prints it placed once written (a broken one null), and nothing as before it while not", () => {
    const placed = {
      label: "Rezervasyon",
      kind: "url",
      target: null,
      path: "https://example.com/r",
    }
    const doc = withMainSections(
      layoutDocument.parse({ header: [bar("standard", { highlight_link: BOOK })] }),
      LEFT
    )
    expect(mainSectionsOf(doc, () => placed).header_bar).toEqual({
      id: "mainheader",
      type: "header_bar",
      variant: "standard",
      sticky: true,
      menu_images: "submenus",
      search_style: "field",
      highlight_link: placed,
    })
    expect(mainSectionsOf(doc).header_bar.highlight_link).toBeNull()
    const plain = withMainSections(layoutDocument.parse({ header: [bar("centered")] }), LEFT)
    expect(mainSectionsOf(plain, () => placed).header_bar).not.toHaveProperty("highlight_link")
    // The catalog prints it in its own settings only, as before
    const catalog = withMainSections(
      layoutDocument.parse({ header: [bar("catalog", { highlight_link: BOOK })] }),
      LEFT
    )
    const printed = mainSectionsOf(catalog, () => placed).header_bar
    expect(printed).not.toHaveProperty("highlight_link")
    expect(printed.catalog?.highlight_link).toEqual(placed)
  })
})
