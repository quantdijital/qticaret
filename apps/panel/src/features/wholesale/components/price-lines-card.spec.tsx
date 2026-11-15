import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LinesPage, ListOwner } from "@/features/wholesale/api/types"
import { clientWith, line, linesPage, renderWith } from "@/features/wholesale/wholesale.fixtures"
import { PriceLinesCard } from "./price-lines-card"

const sdkMock = vi.hoisted(() => ({ fetch: vi.fn(), variants: vi.fn() }))

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: sdkMock.fetch },
    admin: { productVariant: { list: sdkMock.variants } },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

type Init = { method?: string; body?: unknown; query?: Record<string, unknown> } | undefined

function serve(page: LinesPage, write: () => Promise<unknown> = () => Promise.resolve({})) {
  sdkMock.fetch.mockImplementation((_path: string, init: Init) =>
    init?.method === "POST" ? write() : Promise.resolve(page)
  )
}

const posts = () =>
  (sdkMock.fetch.mock.calls as [string, Init][]).filter(([, init]) => init?.method === "POST")

function renderCard(owner: ListOwner = { kind: "tier", id: "wst_1" }, syncing = false) {
  renderWith(clientWith(), <PriceLinesCard owner={owner} percent={20} syncing={syncing} />)
}

describe("PriceLinesCard", () => {
  beforeEach(() => {
    sdkMock.fetch.mockReset()
    sdkMock.variants.mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it("shows retail now beside the wholesale price without and with KDV, and where it comes from", async () => {
    serve(
      linesPage([
        line(),
        line({ variant_id: "variant_2", variant_title: "25 cm", source: "manual" }),
      ])
    )
    renderCard()
    expect(await screen.findAllByText("Şef bıçağı")).toHaveLength(2)
    const row = screen.getByText("20 cm · SEF-20").closest("tr") as HTMLElement
    expect(within(row).getByText(/1\.200,00/)).toBeInTheDocument()
    expect(within(row).getByText(/800,00/)).toBeInTheDocument()
    expect(within(row).getByText(/960,00/)).toBeInTheDocument()
    expect(within(row).getByText("Oran")).toBeInTheDocument()
    expect(screen.getByText("Elle")).toBeInTheDocument()
    expect(sdkMock.fetch).toHaveBeenCalledWith("/admin/wholesale/tiers/wst_1/lines", {
      query: { limit: 25, offset: 0 },
    })
  })

  it("searches the list on the server", async () => {
    serve(linesPage([line()]))
    renderCard({ kind: "account", id: "wsa_1" })
    await screen.findByText("Şef bıçağı")
    await userEvent.type(screen.getByPlaceholderText("Ürün, varyant ya da stok kodu ara"), "SEF")
    await waitFor(() => {
      expect(sdkMock.fetch).toHaveBeenCalledWith("/admin/wholesale/accounts/wsa_1/lines", {
        query: { limit: 25, offset: 0, q: "SEF" },
      })
    })
  })

  it("saves a price typed without KDV from the line's window", async () => {
    serve(linesPage([line()]))
    renderCard()
    await userEvent.click(await screen.findByText("Şef bıçağı"))
    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByText("Şu an oranla hesaplanıyor. Yazdığınız fiyat oranın yerine geçer.")
    ).toBeInTheDocument()
    const field = within(dialog).getByLabelText(/^Toptan fiyat, KDV hariç/)
    expect(field).toHaveValue("800,00")
    await userEvent.clear(field)
    await userEvent.type(field, "1.250,50")
    // Above retail now: a warning, the save still allowed
    expect(
      within(dialog).getByText(/Bugünkü perakende fiyat bu toptan fiyatın altında/)
    ).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(posts()[0]).toEqual([
        "/admin/wholesale/tiers/wst_1/prices",
        { method: "POST", body: { set: [{ variant_id: "variant_1", net: "1250.50" }] } },
      ])
    })
    expect(toast.success).toHaveBeenCalledWith("Toptan fiyat kaydedildi.")
  })

  it("refuses a price of nothing before sending", async () => {
    serve(linesPage([line()]))
    renderCard()
    await userEvent.click(await screen.findByText("Şef bıçağı"))
    const dialog = await screen.findByRole("dialog")
    const field = within(dialog).getByLabelText(/^Toptan fiyat, KDV hariç/)
    await userEvent.clear(field)
    await userEvent.type(field, "0")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    expect(
      within(dialog).getByText("Fiyatı 0'dan büyük, en çok 20.000.000 TL olarak girin.")
    ).toBeInTheDocument()
    expect(posts()).toHaveLength(0)
  })

  it("takes a hand-entered price away, back to the rate", async () => {
    serve(linesPage([line({ source: "manual" })]))
    renderCard({ kind: "account", id: "wsa_1" })
    await userEvent.click(await screen.findByText("Şef bıçağı"))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Elle fiyatı kaldır" }))
    await waitFor(() => {
      expect(posts()[0]).toEqual([
        "/admin/wholesale/accounts/wsa_1/prices",
        { method: "POST", body: { remove: ["variant_1"] } },
      ])
    })
  })

  it("warns, without blocking, where retail undercuts wholesale and where the rate gives nothing", async () => {
    sdkMock.variants.mockResolvedValue({
      variants: [{ id: "variant_9", title: "Mini", sku: "KUR-1", product: { title: "Kürdan" } }],
    })
    serve(
      linesPage([line({ undercut: true })], {
        undercut_count: 3,
        rate_zero: { count: 1, variant_ids: ["variant_9"] },
      })
    )
    renderCard({ kind: "tier", id: "wst_1" }, true)
    expect(await screen.findByText("Perakende daha ucuz")).toBeInTheDocument()
    expect(screen.getByText("Fiyatlar güncelleniyor.")).toBeInTheDocument()
    expect(
      screen.getByText(/^3 ürün çeşidinde bugünkü perakende fiyat toptan fiyatın altında/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/^1 ürün çeşidinin fiyatı bu oranla 0,00 TL olurdu/)
    ).toBeInTheDocument()
    await userEvent.click(await screen.findByRole("button", { name: "Fiyat gir" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Kürdan · Mini · KUR-1")).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText(/^Toptan fiyat, KDV hariç/), "0,50")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(posts()[0]?.[1]?.body).toEqual({ set: [{ variant_id: "variant_9", net: "0.50" }] })
    })
  })
})
