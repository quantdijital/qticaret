import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { FOOTER_BAR_DEFAULTS } from "@qticaret/types"
import "@/lib/i18n"
import type {
  FooterBarSection,
  FooterBlock,
  FooterRow,
  FooterRowsSection,
  LayoutDocument,
} from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { DOC } from "../theme-editor.fixtures"
import { newRow } from "./footer-rows-ops"
import { newBlock, seedFooter } from "./footer-rows-seed"
import { FooterRowsTree } from "./footer-rows-tree"

const ledger = {
  id: "mainfooter",
  type: "footer_bar",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "ledger",
  ...FOOTER_BAR_DEFAULTS,
  payment_badges: [],
} as FooterBarSection

const text = (id: string, title: string): FooterBlock => ({ ...newBlock("text", id), title })

/** Two rows: [Alpha, Beta | Gamma] and [Delta]. */
function footerOf(...extra: FooterBlock[]): FooterRowsSection {
  const [seeded] = seedFooter([ledger], 0, () => "x") as [FooterRowsSection]
  const rows: FooterRow[] = [
    {
      ...newRow("r1", "1-1"),
      columns: [
        { blocks: [text("a", "Alpha"), text("b", "Beta")] },
        { blocks: [text("g", "Gamma"), ...extra] },
      ],
    },
    { ...newRow("r2", "1"), columns: [{ blocks: [text("d", "Delta")] }] },
  ]
  return { ...seeded, rows }
}

const doc = { ...DOC, settings: { ...DOC.settings, menus: [] } } as LayoutDocument

/** The tree over a footer that takes its own updates, as the editor does. */
function setup(start = footerOf()) {
  const actions: EditorAction[] = []
  const latest = { section: start }
  function Harness() {
    const [section, setSection] = useState(start)
    return (
      <FooterRowsTree
        section={section}
        doc={doc}
        problems={{}}
        openedPart={null}
        onOpenPart={vi.fn()}
        dispatch={(action) => {
          actions.push(action)
          if (action.type === "update") {
            latest.section = action.section as FooterRowsSection
            setSection(latest.section)
          }
        }}
      />
    )
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness />
    </QueryClientProvider>
  )
  /** Each row's columns as block titles, as last sent. */
  const titles = () =>
    latest.section.rows.map((row) =>
      row.columns.map((column) =>
        column.blocks.map((block) => ("title" in block ? block.title : block.type))
      )
    )
  return { actions, titles, user: userEvent.setup() }
}

const live = () => document.querySelector("[aria-live='polite']")

describe("the free rows footer's tree (adr/0070 §7)", () => {
  it("moves a block by its arrow, in one step, and says where it went", async () => {
    const { actions, titles, user } = setup()
    await user.click(screen.getByRole("button", { name: "Beta: aşağı taşı" }))
    expect(titles()).toEqual([[["Alpha"], ["Beta", "Gamma"]], [["Delta"]]])
    expect(actions).toHaveLength(1)
    expect(live()).toHaveTextContent("Beta, Satır 1 · Sütun 2 konumuna taşındı.")
    await user.click(screen.getByRole("button", { name: "Beta: yukarı taşı" }))
    expect(titles()).toEqual([[["Alpha", "Beta"], ["Gamma"]], [["Delta"]]])
  })

  it("takes the first block nowhere up", () => {
    setup()
    expect(screen.getByRole("button", { name: "Alpha: yukarı taşı" })).toBeDisabled()
  })

  it("moves a row by its arrow and says its new place", async () => {
    const { titles, user } = setup()
    const [up] = screen.getAllByRole("button", { name: /^Satır 2 .*: yukarı taşı$/ })
    if (up) await user.click(up)
    expect(titles()).toEqual([[["Delta"]], [["Alpha", "Beta"], ["Gamma"]]])
    expect(live()).toHaveTextContent("Satır 1. sıraya taşındı.")
  })

  it("moves a block with Taşı… to the end of the column picked, as dragging would", async () => {
    const { actions, titles, user } = setup()
    await user.click(screen.getByRole("button", { name: "Alpha için işlemler" }))
    await user.click(await screen.findByRole("menuitem", { name: "Taşı…" }))
    const dialog = await screen.findByRole("dialog", { name: "Alpha bloğunu taşı" })
    await user.click(within(dialog).getByRole("radio", { name: "Satır 2 · Sütun 1" }))
    await user.click(within(dialog).getByRole("button", { name: "Taşı" }))
    expect(titles()).toEqual([[["Beta"], ["Gamma"]], [["Delta", "Alpha"]]])
    expect(actions).toHaveLength(1)
    expect(live()).toHaveTextContent("Alpha, Satır 2 · Sütun 1 konumuna taşındı.")
  })

  it("does not offer the column the block already stands in", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: "Alpha için işlemler" }))
    await user.click(await screen.findByRole("menuitem", { name: "Taşı…" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("button", { name: "Taşı" })).toBeDisabled()
  })

  it("closes a type whose limit is reached in Blok ekle, saying why", async () => {
    const { user } = setup(footerOf(newBlock("brand", "br")))
    await user.click(screen.getByRole("button", { name: "Satır 1, Sütun 1: blok ekle" }))
    const items = await screen.findAllByRole("menuitem")
    const brand = items.find((item) => item.textContent.includes("yalnız 1 tane"))
    expect(brand).toHaveAttribute("aria-disabled", "true")
    const free = items.filter((item) => item.getAttribute("aria-disabled") !== "true")
    expect(free.length).toBeGreaterThan(0)
  })

  it("adds a row at the end and shows the fixed strip under all", async () => {
    const { titles, user } = setup()
    await user.click(screen.getByRole("button", { name: "Satır ekle" }))
    expect(titles()).toHaveLength(3)
    expect(screen.getByText("Yasal şerit ve alt satır (sabit)")).toBeInTheDocument()
  })
})
