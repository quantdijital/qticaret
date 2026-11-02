import { describe, expect, it } from "vitest"
import type { Menu } from "@/features/storefront/api/menus"
import {
  draftOf,
  drop,
  fits,
  indent,
  itemsOf,
  labelProblem,
  moveDown,
  moveUp,
  outdent,
  removeRow,
  sameDraft,
} from "./menu-rows"
import type { MenuRow } from "./menu-rows"

const row = (key: string, depth: 0 | 1 = 0, label = ""): MenuRow => ({
  key,
  depth,
  to: { kind: "category", target: `pcat_${key}` },
  label,
  name: key,
  path: `/${key}`,
  broken: false,
})

// a (b, c), d, e (f)
const ROWS = [row("a"), row("b", 1), row("c", 1), row("d"), row("e"), row("f", 1)]
const shape = (rows: readonly MenuRow[] | null) =>
  rows?.map((each) => `${each.depth === 1 ? "-" : ""}${each.key}`).join(" ")

describe("menu rows", () => {
  it("reads a saved menu as flat rows and sends it back as items with children", () => {
    const menu: Menu = {
      id: "smenu_1",
      title: " Ana menü ",
      location: "main",
      rank: 0,
      items: [
        {
          id: "sml_a",
          kind: "category",
          target: "pcat_a",
          url: null,
          label: null,
          name: "A",
          path: "/a",
          broken: false,
          children: [
            {
              id: "sml_b",
              kind: "url",
              target: null,
              url: "https://example.com",
              label: "B",
              name: null,
              path: "https://example.com",
              broken: false,
              children: [],
            },
          ],
        },
      ],
    }
    const draft = draftOf(menu)

    expect(shape(draft.rows)).toBe("sml_a -sml_b")
    expect(itemsOf(draft.rows)).toEqual([
      {
        link: { kind: "category", target: "pcat_a", label: null },
        children: [{ kind: "url", url: "https://example.com", label: "B" }],
      },
    ])
    // A space typed around the title or a name changes nothing that is sent
    expect(sameDraft(draft, { title: "Ana menü", rows: draft.rows })).toBe(true)
  })

  it("moves a top-level row with its children past the next block, and a child among its siblings only", () => {
    expect(shape(moveDown(ROWS, 0))).toBe("d a -b -c e -f")
    expect(shape(moveUp(ROWS, 4))).toBe("a -b -c e -f d")
    expect(shape(moveDown(ROWS, 1))).toBe("a -c -b d e -f")
    expect(moveUp(ROWS, 1)).toBeNull()
    expect(moveDown(ROWS, 2)).toBeNull()
    expect(moveUp(ROWS, 0)).toBeNull()
    expect(moveDown(ROWS, 4)).toBeNull()
  })

  it("puts a row under the one above, and takes a child out after its parent's block", () => {
    expect(shape(indent(ROWS, 3))).toBe("a -b -c -d e -f")
    // Its own children come along, under the new parent
    expect(shape(indent(ROWS, 4))).toBe("a -b -c d -e -f")
    expect(indent(ROWS, 0)).toBeNull()
    expect(shape(outdent(ROWS, 1))).toBe("a -c b d e -f")
  })

  it("drops a dragged row at the level of the row it lands on", () => {
    // A row without children takes a child's place among the children
    expect(shape(drop(ROWS, "d", "c", "before", true))).toBe("a -b -d -c e -f")
    // A child dropped on a top-level row lands beside its block
    expect(shape(drop(ROWS, "f", "a", "before", true))).toBe("f a -b -c d e")
    expect(shape(drop(ROWS, "f", "a", "after", true))).toBe("a -b -c f d e")
    // A row with children stays top-level, beside the other's block
    expect(shape(drop(ROWS, "e", "b", "before", true))).toBe("e -f a -b -c d")
    // A flat menu never nests
    expect(shape(drop(ROWS, "d", "c", "after", false))).toBe("a -b -c d e -f")
    // Onto itself or one of its own children: nothing moves
    expect(drop(ROWS, "a", "b", "after", true)).toBeNull()
    expect(drop(ROWS, "a", "a", "after", true)).toBeNull()
  })

  it("takes a top-level row out with its children", () => {
    expect(shape(removeRow(ROWS, 0))).toBe("d e -f")
    expect(shape(removeRow(ROWS, 5))).toBe("a -b -c d e")
  })

  it("keeps to the server's limits", () => {
    const thirty = Array.from({ length: 30 }, (_, index) => row(`r${String(index)}`))
    expect(fits(thirty)).toBe(true)
    expect(fits([...thirty, row("x")])).toBe(false)
    const parent = [
      row("p"),
      ...Array.from({ length: 20 }, (_, index) => row(`c${String(index)}`, 1)),
    ]
    expect(fits(parent)).toBe(true)
    // A twenty-first child does not fit under it
    expect(indent([...parent, row("x")], 21)).toBeNull()
  })

  it("asks an address for a name and refuses a name too long or with a control character", () => {
    const address: MenuRow = { ...row("u"), to: { kind: "url", url: "/kampanyalar" } }
    expect(labelProblem(address)).toBe("required")
    expect(labelProblem({ ...address, label: "Kampanyalar" })).toBeNull()
    expect(labelProblem(row("a"))).toBeNull()
    expect(labelProblem(row("a", 0, "x".repeat(61)))).toBe("tooLong")
    expect(labelProblem(row("a", 0, "a\u0007b"))).toBe("textInvalid")
  })
})
