import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { FooterSection, LayoutDocument } from "@/features/storefront/api/layout"
import { editorReducer, initialEditorState } from "@/features/storefront/layout/editor-state"
import {
  footerAbove,
  footerMarqueeFull,
  footerTypesLeft,
  newFooterSection,
} from "@/features/storefront/layout/footer-group"
import { marqueesOn, newHomeSection } from "@/features/storefront/layout/sections"
import { AddSectionDialog } from "./add-section-dialog"
import { takesLook } from "./forms/field-registry"
import { SectionTree } from "./section-tree"
import { DOC } from "./theme-editor.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

/** The footer group with the shop's sections above its bar (adr/0070 §4). */
const withFooter = (...sections: FooterSection[]): LayoutDocument => ({
  ...DOC,
  footer: [...DOC.footer, ...sections],
})
const strip = newFooterSection("marquee", "altkayan01")
const text = newFooterSection("rich_text", "altmetin01")
const badges = newFooterSection("trust_badges", "altguven01")

function tree(doc: LayoutDocument, more: { onAddFooterSection?: () => void } = {}) {
  const dispatch = vi.fn()
  const onOpen = vi.fn()
  render(
    <SectionTree
      page="home"
      doc={doc}
      problems={new Set()}
      dispatch={dispatch}
      onOpen={onOpen}
      onRemove={() => undefined}
      onAddSection={() => undefined}
      onTheme={() => undefined}
      themeProblem={false}
      onLooks={() => undefined}
      looksProblem={false}
      onPreferences={() => undefined}
      {...more}
    />
  )
  return { dispatch, onOpen }
}

describe("the footer group (adr/0070 §4)", () => {
  it("lists its sections in their order above the fixed footer bar", () => {
    tree(withFooter(strip, text))
    const list = screen.getByRole("list", { name: "Alt bilginin bölümleri" })
    const names = within(list)
      .getAllByRole("listitem")
      .map((item) => item.textContent)
    expect(names[0]).toContain("E-bülten")
    expect(names[1]).toContain("Kayan yazı")
    expect(names[2]).toContain("Metin")
    // The bar after the list and the add row: its place is the bottom
    const add = screen.getByRole("button", { name: "Alt bilgiye bölüm ekle" })
    const bar = screen.getByRole("button", { name: /Alt bilgi çubuğu|Alt bilgi$/ })
    expect(add.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("opens the chooser from its add row, closed once every type is there", async () => {
    const onAddFooterSection = vi.fn()
    tree(withFooter(strip, text), { onAddFooterSection })
    await userEvent.click(screen.getByRole("button", { name: "Alt bilgiye bölüm ekle" }))
    expect(onAddFooterSection).toHaveBeenCalledOnce()
  })

  it("offers each type once, the footer's box under its own name", async () => {
    expect(footerTypesLeft(withFooter(strip))).toEqual(["rich_text", "trust_badges"])
    expect(footerTypesLeft(withFooter(strip, text, badges))).toEqual([])
    const onPick = vi.fn()
    render(
      <AddSectionDialog
        open
        page="footer"
        footerTypes={["newsletter", "rich_text"]}
        placement="bottom"
        marqueeFull={false}
        onOpenChange={() => undefined}
        onPick={onPick}
      />
    )
    expect(screen.getAllByRole("button", { name: /E-bülten|Metin|Kayan|Güven/ })).toHaveLength(2)
    await userEvent.click(screen.getByRole("button", { name: /E-bülten/ }))
    expect(onPick).toHaveBeenCalledWith("newsletter")
  })

  it("shows the full note once the group holds every type", () => {
    const full = withFooter(strip, text, badges)
    tree(full)
    expect(screen.getByRole("button", { name: "Alt bilgiye bölüm ekle" })).toBeDisabled()
  })

  it("moves a section within the group, the bar kept out of the order", () => {
    const doc = withFooter(strip, text)
    const moved = editorReducer(initialEditorState(doc), {
      type: "move",
      id: "altmetin01",
      to: 0,
    }).doc
    expect(footerAbove(moved).map((section) => section.id)).toEqual([
      "altmetin01",
      "ebultenkutusu",
      "altkayan01",
    ])
    expect(moved.footer.filter((section) => section.type === "footer_bar")).toHaveLength(1)
  })

  it("counts its strip on every page and gives its page sections a look", () => {
    const doc = withFooter(strip)
    expect(marqueesOn(doc, "home")).toBe(1)
    expect(footerMarqueeFull(doc)).toBe(false)
    expect(
      footerMarqueeFull({ ...doc, home: [...doc.home, newHomeSection("marquee", "anakayan1")] })
    ).toBe(true)
    expect(takesLook(text, "footer")).toBe(true)
    expect(takesLook(newFooterSection("newsletter", "altbulten2"), "footer")).toBe(false)
  })
})
