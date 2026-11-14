import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LayoutDocument, MarqueeSection } from "@/features/storefront/api/layout"
import { documentProblems, sectionProblems } from "@/features/storefront/layout/problems"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import {
  HOME_TYPES,
  marqueesOn,
  newHeaderMarquee,
  newHomeSection,
} from "@/features/storefront/layout/sections"
import { AddSectionDialog } from "../add-section-dialog"
import { SectionTree } from "../section-tree"
import { DOC } from "../theme-editor.fixtures"
import { sectionFields } from "./field-registry"
import { MarqueeForm } from "./marquee-form"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const newStrip = (id = "kayanyazi") => newHomeSection("marquee", id) as MarqueeSection

/** The form as the editor holds it: every change kept, its problems found again. */
function renderForm(section = newStrip(), extra: SectionProblems = {}) {
  const changes: MarqueeSection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <MarqueeForm
        section={value}
        problems={{ ...sectionProblems(value), ...extra }}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Holder />
    </QueryClientProvider>
  )
  return changes
}

/** adr/0049 Ek 2026-11-14 §4.1: the scrolling strip in the theme editor. */
describe("MarqueeForm", () => {
  it("is offered on the home page, new with one empty item and the default steps", () => {
    expect(HOME_TYPES).toContain("marquee")
    expect(newStrip()).toMatchObject({
      type: "marquee",
      items: [{ icon: null, text: "", subtext: null, link: null }],
      speed: "medium",
      direction: "left",
      ground: "stage",
      size: "medium",
      separator: "dot",
    })
    expect(sectionProblems(newStrip())).toEqual({ "items.0.text": "required" })
  })

  it("writes an item, adds a second, and keeps at least one", async () => {
    const changes = renderForm()

    expect(screen.getByRole("button", { name: "1. öge: kaldır" })).toBeDisabled()
    await userEvent.type(screen.getByLabelText("1. ögenin yazısı"), "Kargo")
    expect(changes.at(-1)?.items[0]).toMatchObject({ text: "Kargo" })

    await userEvent.click(screen.getByRole("button", { name: "Öge ekle" }))
    expect(changes.at(-1)?.items).toHaveLength(2)
    await userEvent.type(screen.getByLabelText("2. ögenin alt satırı (isteğe bağlı)"), "Bugün")
    expect(changes.at(-1)?.items[1]).toMatchObject({ text: "", subtext: "Bugün" })

    await userEvent.click(screen.getByRole("button", { name: "2. öge: kaldır" }))
    expect(changes.at(-1)?.items).toEqual([
      { icon: null, text: "Kargo", subtext: null, link: null },
    ])
  })

  it("stops adding at eight items", () => {
    const item = { icon: null, text: "Öge", subtext: null, link: null }
    renderForm({ ...newStrip(), items: Array.from({ length: 8 }, () => item) })
    expect(screen.getByRole("button", { name: "Öge ekle" })).toBeDisabled()
  })

  it("picks its size among three steps, each its own change", async () => {
    const changes = renderForm()

    expect(screen.getByRole("radio", { name: /Orta/ })).toHaveAttribute("data-state", "on")
    await userEvent.click(screen.getByRole("radio", { name: /Büyük/ }))
    expect(changes.at(-1)).toMatchObject({ size: "large" })
    await userEvent.click(screen.getByRole("button", { name: "Varsayılana dön" }))
    expect(changes.at(-1)).toMatchObject({ size: "medium" })
  })

  it("says when the page shows more strips than it may", () => {
    renderForm(newStrip(), { limit: "marqueeLimit" })
    expect(screen.getByText(/en çok 2 kayan yazı/)).toHaveAttribute("role", "alert")
  })
})

describe("scrolling strips per page", () => {
  const written = (strip: MarqueeSection | ReturnType<typeof newHeaderMarquee>) => ({
    ...strip,
    items: [{ icon: null, text: "Kargo", subtext: null, link: null }],
  })
  const docWith = (header: number, home: number): LayoutDocument => ({
    ...DOC,
    header: [
      ...DOC.header,
      ...Array.from({ length: header }, (_, at) =>
        written(newHeaderMarquee(`ustserit${String(at)}`))
      ),
    ],
    home: [
      ...DOC.home,
      ...Array.from({ length: home }, (_, at) => written(newStrip(`serit${String(at)}`))),
    ],
  })

  it("counts the header's strip on every page and marks each over the limit", () => {
    expect(marqueesOn(docWith(1, 1), "home")).toBe(2)
    expect(marqueesOn(docWith(1, 1), "product")).toBe(1)
    expect(documentProblems(docWith(1, 1)).get("serit0")).toBeUndefined()

    const problems = documentProblems(docWith(1, 2))
    expect(problems.get("ustserit0")).toEqual({ limit: "marqueeLimit" })
    expect(problems.get("serit1")).toEqual({ limit: "marqueeLimit" })
  })

  it("adds the header's strip from the tree, not while a page has its two", async () => {
    const dispatch = vi.fn()
    const tree = (doc: LayoutDocument) => (
      <SectionTree
        page="home"
        doc={doc}
        problems={new Set()}
        dispatch={dispatch}
        onOpen={() => undefined}
        onRemove={() => undefined}
        onAddSection={() => undefined}
        onTheme={() => undefined}
        themeProblem={false}
        onLooks={() => undefined}
        looksProblem={false}
      />
    )
    const { rerender } = render(tree(docWith(0, 1)))
    await userEvent.click(screen.getByRole("button", { name: "Kayan yazı ekle" }))
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "add", group: "header" })
    )
    rerender(tree(docWith(0, 2)))
    expect(screen.getByRole("button", { name: "Kayan yazı ekle" })).toBeDisabled()
  })

  it("offers no other strip in the add dialog once the page has its two", () => {
    render(
      <AddSectionDialog
        open
        page="home"
        placement="bottom"
        marqueeFull
        onOpenChange={() => undefined}
        onPick={() => undefined}
      />
    )
    expect(screen.getByRole("button", { name: /Kayan yazı/ })).toBeDisabled()
    expect(screen.getByText(/Bu sayfada zaten 2 kayan yazı var/)).toBeInTheDocument()
  })

  it("finds its settings in the search: the size in the content, the ground with the look", () => {
    const fields = sectionFields(newStrip(), "home")
    expect(fields.find((field) => field.key === "marquee.size")?.group).toBe("content")
    expect(fields.find((field) => field.key === "marquee.ground")?.group).toBe("look")
    expect(fields.map((field) => field.key)).toContain("look.width")
    expect(fields.map((field) => field.key)).not.toContain("look.ground")
    const header = sectionFields(newHeaderMarquee("ustserit"), "header")
    expect(header.some((field) => field.key.startsWith("look."))).toBe(false)
    expect(header.some((field) => field.key === "marquee.speed")).toBe(true)
  })
})
