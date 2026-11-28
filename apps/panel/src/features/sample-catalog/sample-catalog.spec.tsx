import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { isSampleProduct } from "@/features/sample-catalog/api"
import type { SampleCatalogAnswer, SampleLoadJob } from "@/features/sample-catalog/api"
import { SampleCatalogCard } from "./sample-catalog-card"
import { SampleOffer } from "./sample-offer"

const fetchMock = vi.hoisted(() => vi.fn())
const can = vi.hoisted(() => ({ value: true }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => can.value }))

const SET = { pack: "travel", name: "Örnek turlar", version: 1, products: 10, loaded: false }
const product = (
  id: string,
  extra: Partial<{ edited: boolean; blocked: "ordered" | null }> = {}
) => ({
  id,
  title: `Tur ${id}`,
  handle: id,
  thumbnail: null,
  pack: "travel",
  edited: false,
  blocked: null,
  ...extra,
})

const answer = (
  over: Partial<SampleCatalogAnswer["sample_catalog"]> = {},
  job: SampleLoadJob | null = null
) => ({
  sample_catalog: {
    sets: [SET],
    catalog_empty: true,
    products: [],
    categories: 0,
    reviews: 0,
    ...over,
  },
  load_job: job,
})

const PLAN = {
  products: 1,
  categories: 0,
  reviews: 4,
  categories_hidden: 0,
  blocked: [
    { id: "p3", title: "Tur p3", reason: "ordered" },
    { id: "p4", title: "Tur p4", reason: "customer_content", customer_content: 2 },
  ],
  categories_kept: [{ id: "c1", name: "Kapadokya", reason: "own_products" }],
}

const renderWith = (node: React.ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {node}
    </QueryClientProvider>
  )

describe("isSampleProduct", () => {
  it("is a sample only while its mark names its own id (a copy is the shop's)", () => {
    expect(isSampleProduct({ id: "p1", metadata: { sample: "travel@1", sample_of: "p1" } })).toBe(
      true
    )
    expect(isSampleProduct({ id: "p2", metadata: { sample: "travel@1", sample_of: "p1" } })).toBe(
      false
    )
    expect(isSampleProduct({ id: "p1", metadata: { sample: "", sample_of: "p1" } })).toBe(false)
    // Half made by a stopped load: the tag and the job making it, no sample_of yet
    expect(
      isSampleProduct({ id: "p1", metadata: { sample: "travel@1", sample_job: "job_1" } })
    ).toBe(true)
    // The tag alone names no load: the shop's own
    expect(isSampleProduct({ id: "p1", metadata: { sample: "travel@1" } })).toBe(false)
    expect(isSampleProduct({ id: "p1", metadata: null })).toBe(false)
  })
})

describe("the sample offer in the empty product list", () => {
  beforeEach(() => {
    can.value = true
    fetchMock.mockReset()
  })

  it("loads the pack's set with one button, as a background job", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url === "/admin/sample-catalog" ? answer() : { load_job: null })
    )
    renderWith(<SampleOffer />)
    expect(await screen.findByText("Örnek içerikle başlayın")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Yükle" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/sample-catalog/load", {
        method: "POST",
        body: { pack: "travel" },
      })
    })
  })

  it("shows how far a running load is", async () => {
    const job: SampleLoadJob = {
      id: "job_1",
      pack: "travel",
      status: "running",
      progress: 42,
      summary: null,
      error_code: null,
      created_at: "2026-11-28T06:00:00Z",
    }
    fetchMock.mockResolvedValue(answer({}, job))
    renderWith(<SampleOffer />)
    expect(await screen.findByText("Yükleniyor… %42")).toBeInTheDocument()
  })

  it("polls a running load by its job alone and reads the whole answer once it ends", async () => {
    const running: SampleLoadJob = {
      id: "job_1",
      pack: "travel",
      status: "running",
      progress: 42,
      summary: null,
      error_code: null,
      created_at: "2026-11-28T06:00:00Z",
    }
    const done: SampleLoadJob = { ...running, status: "succeeded", progress: 100 }
    let polls = 0
    fetchMock.mockImplementation((_url: string, init?: { query?: { job?: string } }) => {
      if (init?.query?.job === "1") {
        polls += 1
        return Promise.resolve({ load_job: polls === 1 ? { ...running, progress: 60 } : done })
      }
      return Promise.resolve(polls === 0 ? answer({}, running) : answer({}, done))
    })
    renderWith(<SampleOffer />)
    expect(await screen.findByText("Yükleniyor… %42")).toBeInTheDocument()
    expect(await screen.findByText("Yükleniyor… %60", {}, { timeout: 4000 })).toBeInTheDocument()
    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledTimes(4)
      },
      { timeout: 4000 }
    )
    // The first read whole, two polls by the job, the whole answer again once it ended
    expect(fetchMock.mock.calls.map((call) => (call as unknown[])[1] ?? null)).toEqual([
      null,
      { query: { job: "1" } },
      { query: { job: "1" } },
      null,
    ])
  }, 10000)

  it("is not offered to a role that may not load it", () => {
    can.value = false
    renderWith(<SampleOffer />)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByText("Örnek içerikle başlayın")).not.toBeInTheDocument()
  })
})

describe("the sample content card and its removal", () => {
  beforeEach(() => {
    can.value = true
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string, init?: { body?: { dry_run?: boolean } }) => {
      if (url === "/admin/sample-catalog") {
        return Promise.resolve(
          answer({
            sets: [{ ...SET, loaded: true }],
            catalog_empty: false,
            products: [
              product("p1"),
              product("p2", { edited: true }),
              product("p3", { blocked: "ordered" }),
            ],
            reviews: 4,
          })
        )
      }
      return Promise.resolve(init?.body?.dry_run ? { plan: PLAN } : { result: PLAN })
    })
  })

  it("says how many samples are here and removes the chosen parts, keeping the ones unticked", async () => {
    renderWith(<SampleCatalogCard />)
    expect(await screen.findByText("3 örnek ürün yüklü")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Örnek içeriği kaldır" }))

    const dialog = await screen.findByRole("dialog")
    // What stays, and why
    expect(await within(dialog).findByText("Tur p3: siparişi var")).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        "Tur p4: müşteri içeriği var (2 yorum, soru ya da cevap); önce onları yönetin"
      )
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText("Kapadokya kategorisi: içinde kendi ürününüz var")
    ).toBeInTheDocument()
    // Vazgeç is the red outline, the confirmation the red button
    expect(within(dialog).getByRole("button", { name: "Vazgeç" })).toHaveAttribute(
      "data-variant",
      "cancel"
    )
    expect(within(dialog).getByRole("button", { name: "Kaldır" })).toHaveAttribute(
      "data-variant",
      "destructive"
    )

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Hepsi" }))
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Örnek ürünler" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Bazılarını tut" }))
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Tur p2 silinsin" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaldır" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/sample-catalog/remove", {
        method: "POST",
        body: { parts: ["products"], keep_product_ids: ["p2"] },
      })
    })
    expect(
      await within(dialog).findByRole("heading", { name: "Örnek içerik kaldırıldı" })
    ).toBeInTheDocument()
    expect(within(dialog).getByText("1 ürün, 0 kategori, 4 yorum silindi.")).toBeInTheDocument()
  })
})
