import { render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { ApplyReport } from "@/features/storefront/gallery/apply-report"
import { newHomeSection } from "@/features/storefront/layout/sections"
import type { SectionFlags } from "@/features/storefront/layout/sections"
import { AddSectionDialog } from "./add-section-dialog"
import { SectionFlagsContext } from "./section-flags"
import { SectionTree } from "./section-tree"
import { DOC } from "./theme-editor.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

// No section needs a flag yet (adr/0077 §10): a real type stands in for one
const REQUIRES = { faq: "catalog.booking" }
// The row's own button, not its eye or menu
const ROW = /^Sık sorulan sorular\s?(Kapalı)?$/
const OFF: SectionFlags = { on: new Set(), requires: REQUIRES }
const ON: SectionFlags = { on: new Set(["catalog.booking"]), requires: REQUIRES }

const withFlags = (flags: SectionFlags, children: ReactNode) => (
  <SectionFlagsContext.Provider value={flags}>{children}</SectionFlagsContext.Provider>
)

function chooser(flags: SectionFlags) {
  render(
    withFlags(
      flags,
      <AddSectionDialog
        open
        page="home"
        placement="bottom"
        marqueeFull={false}
        onOpenChange={() => undefined}
        onPick={() => undefined}
      />
    )
  )
}

describe("a section that needs a feature flag in the editor (adr/0077 §8)", () => {
  it("is not offered while its flag is off, the list as before", () => {
    chooser(OFF)

    expect(screen.queryByRole("button", { name: /Sık sorulan sorular/ })).toBeNull()
    expect(screen.getByRole("button", { name: /Görsel bant/ })).toBeEnabled()
    expect(screen.queryByRole("heading", { name: "Tarihli ürünler" })).toBeNull()
  })

  it("is offered under its capability's name while on, the others under their own", () => {
    chooser(ON)

    const dated = screen.getByRole("region", { name: "Tarihli ürünler" })
    expect(within(dated).getByRole("button", { name: /Sık sorulan sorular/ })).toBeEnabled()
    const general = screen.getByRole("region", { name: "Genel bölümler" })
    expect(within(general).getByRole("button", { name: /Görsel bant/ })).toBeEnabled()
    expect(within(general).queryByRole("button", { name: /Sık sorulan sorular/ })).toBeNull()
  })

  it("is kept in the tree while its flag is off, marked off and saying why", () => {
    const doc: LayoutDocument = { ...DOC, home: [newHomeSection("faq", "sorular001")] }
    const tree = (flags: SectionFlags) =>
      withFlags(
        flags,
        <SectionTree
          page="home"
          doc={doc}
          problems={new Set()}
          dispatch={vi.fn()}
          onOpen={vi.fn()}
          onRemove={() => undefined}
          onAddSection={() => undefined}
          onTheme={() => undefined}
          themeProblem={false}
          onLooks={() => undefined}
          looksProblem={false}
          onPreferences={() => undefined}
        />
      )
    const { rerender } = render(tree(OFF))

    const row = screen.getByRole("button", { name: ROW })
    expect(within(row).getByText("Kapalı")).toBeInTheDocument()
    expect(row).toHaveAccessibleDescription(/Tarihli ürünler kapalı olduğu için/)

    rerender(tree(ON))
    expect(within(screen.getByRole("button", { name: ROW })).queryByText("Kapalı")).toBeNull()
  })

  it("dropped from a look applied is named with its capability in the report", () => {
    render(
      <ApplyReport
        report={{
          name: "Rota",
          auto_saved: null,
          saved_name: null,
          skipped: [
            {
              where: "home.kalkislar",
              ref: "departures",
              reason: "feature_off",
              flag: "catalog.booking",
            },
          ],
          kept: [],
        }}
        onClose={() => undefined}
      />
    )

    expect(
      screen.getByText("1 bölüm eklenmedi: Tarihli ürünler bu mağazada kapalı.")
    ).toBeInTheDocument()
    // Not said as a record the shop lacks
    expect(screen.queryByText(/mağazada departures yok/)).toBeNull()
  })
})
