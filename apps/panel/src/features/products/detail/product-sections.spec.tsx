import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductDetail } from "@/features/products/api/products"
import { revealSection } from "@qticaret/admin-ui/hooks/use-section-open"
import type { MainPart } from "@/features/products/layout/parts"
import { PRODUCT, answer } from "./product-fixtures"
import type { Answers } from "./product-fixtures"
import type { DataCardProps } from "./product-sections"
import { MainPartView, SidePartView } from "./product-sections"
import { PRODUCT_TARGETS } from "./sections"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: unknown) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: {
      productCategory: {
        list: () =>
          Promise.resolve({
            product_categories: [
              { id: "pcat_1", name: "Çakılar", handle: "cakilar", parent_category_id: null },
            ],
          }),
      },
    },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// Links as plain anchors: the sections are rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

// The folded parts under the main cards, in their default order
const FOLDED: readonly MainPart[] = ["departures", "program", "seo", "faq"]

// Not drawn by these parts: the data card has its own spec
const NO_DATA = {} as DataCardProps

function renderWith(node: (product: ProductDetail) => ReactNode, answers: Answers = {}) {
  fetchMock.mockImplementation((url: string) => Promise.resolve(answer(url, answers)))
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {node(PRODUCT)}
    </QueryClientProvider>
  )
}

const renderSections = (answers: Answers = {}) =>
  renderWith(
    (product) =>
      FOLDED.map((key) => <MainPartView key={key} part={key} product={product} data={NO_DATA} />),
    answers
  )

const renderSide = (answers: Answers = {}) =>
  renderWith(
    (product) => <SidePartView part="organize" product={product} onTarget={revealSection} />,
    answers
  )

const part = (name: string) => screen.getByRole("button", { name })
const card = (title: string): HTMLElement => {
  const found = screen.getByRole("heading", { name: title }).closest("section")
  if (!found) {
    throw new Error(`no card titled ${title}`)
  }
  return found
}

/** The owner, 2026-11-05: the product page folds what is not edited every day, as the content editor does. */
describe("ProductSections", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
  })

  it("folds the search appearance to a line that says what is in it", async () => {
    renderSections()
    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { expanded: false }).map((button) => button.textContent)
      ).toEqual(["Arama motoru görünümü"])
    })
    expect(part("Arama motoru görünümü")).toHaveAccessibleDescription(
      "Başlık 21/60 · Açıklama (otomatik) 15/155"
    )
  })
})

/** The owner, 2026-11-05: "kategori, marka, kdv sağ sidebar'da"; the rest moved into "Ürün verileri". */
describe("ProductSideCards", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
  })

  it("says what is saved a line at a time", async () => {
    renderSide()
    await waitFor(() => {
      expect(card("Kategori, marka ve KDV")).toBeInTheDocument()
    })
    const organize = within(card("Kategori, marka ve KDV"))
    expect(organize.getByText("Çakılar")).toBeInTheDocument()
    expect(organize.getByText("My L'arte")).toBeInTheDocument()
    expect(await organize.findByText("KDV (%20)")).toBeInTheDocument()
  })

  it("opens the categories' form for the advisor's missing category", async () => {
    renderSide()
    await waitFor(() => {
      expect(card("Kategori, marka ve KDV")).toBeInTheDocument()
    })
    act(() => {
      revealSection(PRODUCT_TARGETS["edit_categories"] ?? "")
    })
    expect(await screen.findByRole("form", { name: "Kategori, marka ve KDV" })).toBeVisible()
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
