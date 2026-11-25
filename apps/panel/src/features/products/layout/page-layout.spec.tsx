import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { LayoutSheet } from "./layout-sheet"
import { HiddenLine, PartSlot } from "./part-slot"
import { DEFAULT_LAYOUT } from "./parts"
import type { PartKey, StoredLayout } from "./parts"
import { usePageLayout } from "./use-page-layout"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: unknown) => Promise<unknown>>())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Each part as a plain card under its advisor target's id
const TARGET: Partial<Record<PartKey, string>> = {
  seo: "product-seo",
  attributes: "product-attributes",
  organize: "product-organize",
}

function Page({ urgent = [] }: { urgent?: PartKey[] }) {
  const page = usePageLayout((key) => urgent.includes(key))
  const draw = (key: PartKey) => {
    const why = page.shownWhy(key)
    return why === "off" ? null : (
      <PartSlot key={key} part={key} why={why}>
        <div id={TARGET[key]} data-testid="part">
          {key}
        </div>
      </PartSlot>
    )
  }
  return (
    <>
      <button
        type="button"
        onClick={() => {
          page.setDraft(page.saved)
        }}
      >
        arrange
      </button>
      {/* The advisor's "Alana git" for the search appearance */}
      <button
        type="button"
        onClick={() => {
          page.goTo("product-seo")
        }}
      >
        go to seo
      </button>
      <main>{page.layout.main.map(draw)}</main>
      <aside>{page.layout.side.map(draw)}</aside>
      <HiddenLine parts={page.away} onShow={page.showAll} />
      <LayoutSheet saved={page.saved} draft={page.draft} onDraft={page.setDraft} />
    </>
  )
}

function renderPage(stored: StoredLayout, urgent: PartKey[] = []) {
  fetchMock.mockImplementation((url: string, init?: unknown) => {
    const body = (init as { body?: unknown } | undefined)?.body
    if (url === "/admin/platform-settings/panel_layout") {
      return Promise.resolve({
        section: "panel_layout",
        values: body ?? { product: stored },
        version: 1,
      })
    }
    return Promise.resolve({})
  })
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Page urgent={urgent} />
    </QueryClientProvider>
  )
}

const drawn = () => screen.getAllByTestId("part").map((part) => part.textContent)

const scroll = vi.fn()

describe("product page layout", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    scroll.mockReset()
    Element.prototype.scrollIntoView = scroll
  })

  it("draws the parts in the shop's order and leaves the hidden ones out, named under the page", async () => {
    // The pictures moved up over the variants
    const main: string[] = DEFAULT_LAYOUT.main.filter((key) => key !== "media")
    main.splice(1, 0, "media")
    renderPage({ main, side: [], hidden: ["faq", "seo"] })
    await waitFor(() => {
      expect(drawn().slice(0, 3)).toEqual(["general", "media", "variants"])
    })
    expect(drawn()).not.toContain("seo")
    expect(
      screen.getByText("Gizli bölümler: Arama motoru görünümü, Sık sorulan sorular")
    ).toBeInTheDocument()

    // "Göster" brings them back for this visit, each saying it is hidden
    await userEvent.click(screen.getByRole("button", { name: "Göster" }))
    expect(drawn()).toContain("seo")
    expect(screen.getAllByText("Gizlenen bölüm: bu ziyaret için gösteriliyor.")).not.toHaveLength(0)
    expect(screen.queryByText(/Gizli bölümler/)).toBeNull()
  })

  it("shows a hidden part the advisor's Alana git leads to", async () => {
    renderPage({ main: [], side: [], hidden: ["seo"] })
    await waitFor(() => {
      expect(drawn()).not.toContain("seo")
    })
    await userEvent.click(screen.getByRole("button", { name: "go to seo" }))
    expect(drawn()).toContain("seo")
    expect(scroll).toHaveBeenCalled()
    expect(screen.getByText("Gizlenen bölüm: bu ziyaret için gösteriliyor.")).toBeInTheDocument()
  })

  it("shows a hidden part that needs attention anyway, and says why", async () => {
    renderPage({ main: [], side: [], hidden: ["attributes"] }, ["attributes"])
    expect(
      await screen.findByText(
        "Gizlenen bölüm: ilgilenilmesi gereken bir şey olduğu için gösteriliyor."
      )
    ).toBeInTheDocument()
    expect(drawn()).toContain("attributes")
    expect(screen.queryByText(/Gizli bölümler/)).toBeNull()
  })

  it("arranges the page in a side sheet the page follows, and saves it for the team", async () => {
    const user = userEvent.setup()
    renderPage({ main: [], side: [], hidden: [] })
    await waitFor(() => {
      expect(drawn()).toContain("seo")
    })
    await user.click(screen.getByRole("button", { name: "arrange" }))
    const sheet = screen.getByRole("dialog", { name: "Ürün sayfasını düzenle" })
    // The name, the variants and the advisor are always shown: no switch to turn them off
    expect(within(sheet).queryByRole("switch", { name: "Genel bilgiler: göster" })).toBeNull()
    expect(within(sheet).queryByRole("switch", { name: "SEO danışmanı: göster" })).toBeNull()

    await user.click(within(sheet).getByRole("switch", { name: "Arama motoru görünümü: göster" }))
    await user.click(within(sheet).getByRole("button", { name: "Görseller: yukarı taşı" }))
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/panel_layout", {
        method: "POST",
        body: {
          product: {
            main: [
              "general",
              "media",
              "variants",
              "description",
              "shortDescription",
              "departures",
              "program",
              "seo",
              "attributes",
              "faq",
              "addons",
              "priceHistory",
            ],
            side: ["summary", "advisor", "organize", "catalog", "shipping"],
            hidden: ["seo"],
          },
        },
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    expect(drawn().slice(0, 3)).toEqual(["general", "media", "variants"])
    expect(drawn()).not.toContain("seo")
  })

  it("goes back to the default, saved as empty lists", async () => {
    const user = userEvent.setup()
    renderPage({ main: [], side: [], hidden: ["faq"] })
    await waitFor(() => {
      expect(screen.getByText(/Gizli bölümler/)).toBeInTheDocument()
    })
    await user.click(screen.getByRole("button", { name: "arrange" }))
    const sheet = screen.getByRole("dialog", { name: "Ürün sayfasını düzenle" })
    await user.click(within(sheet).getByRole("button", { name: "Varsayılana dön" }))
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/panel_layout", {
        method: "POST",
        body: { product: { main: [], side: [], hidden: [] } },
      })
    })
  })
})
