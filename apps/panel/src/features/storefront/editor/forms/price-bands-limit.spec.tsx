import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LayoutDocument, PriceBandsSection } from "@/features/storefront/api/layout"
import { documentProblems } from "@/features/storefront/layout/problems"
import { findSection, newHomeSection, priceBandsOn } from "@/features/storefront/layout/sections"
import { AddSectionDialog } from "../add-section-dialog"
import { OpenedForm } from "../opened-form"
import { DOC } from "../theme-editor.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const strip = (id: string): PriceBandsSection => ({
  ...(newHomeSection("price_bands", id) as PriceBandsSection),
  bands: [
    { label: "Ucuz", text: null, max: 500 },
    { label: "Pahalı", text: null, max: null },
  ],
})

const docWith = (count: number): LayoutDocument => ({
  ...DOC,
  home: [...DOC.home, ...Array.from({ length: count }, (_, at) => strip(`fiyatbant${String(at)}`))],
})

/** The open strip's panel as the editor shows it. */
function openStrip(doc: LayoutDocument, id: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OpenedForm
        opened={{ kind: "section", id }}
        found={findSection(doc, id)}
        doc={doc}
        problems={documentProblems(doc)}
        dispatch={() => undefined}
        onUndo={() => undefined}
        onRemove={() => undefined}
        onClose={() => undefined}
      />
    </QueryClientProvider>
  )
}

describe("price bands strips per page", () => {
  it("marks each strip when the home page has more than two", () => {
    expect(priceBandsOn(docWith(2), "home")).toBe(2)
    expect(documentProblems(docWith(2)).get("fiyatbant1")).toBeUndefined()

    const problems = documentProblems(docWith(3))
    expect(problems.get("fiyatbant0")).toEqual({ limit: "bandsLimit" })
    expect(problems.get("fiyatbant2")).toEqual({ limit: "bandsLimit" })
  })

  it("offers no other strip in the add dialog once the home page has its two, and says why", () => {
    render(
      <AddSectionDialog
        open
        page="home"
        placement="bottom"
        marqueeFull={false}
        priceBandsFull
        onOpenChange={() => undefined}
        onPick={() => undefined}
      />
    )
    expect(screen.getByRole("button", { name: /Fiyat bantları/ })).toBeDisabled()
    expect(screen.getByText(/Ana sayfada zaten 2 fiyat bandı bölümü var/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Kayan yazı/ })).toBeEnabled()
  })

  it("copies a strip while there is room, not once the page has its two, and says why", () => {
    const { unmount } = openStrip(docWith(1), "fiyatbant0")
    expect(screen.getByRole("button", { name: "Çoğalt" })).toBeEnabled()
    unmount()

    openStrip(docWith(2), "fiyatbant0")
    expect(screen.getByRole("button", { name: "Çoğalt" })).toBeDisabled()
    expect(screen.getByText(/Ana sayfada zaten 2 fiyat bandı bölümü var/)).toBeInTheDocument()
  })

  it("says in the strip's form when the page has more than it may", () => {
    openStrip(docWith(3), "fiyatbant2")
    expect(screen.getByText(/en çok 2 fiyat bandı bölümü olabilir/)).toHaveAttribute(
      "role",
      "alert"
    )
  })
})
