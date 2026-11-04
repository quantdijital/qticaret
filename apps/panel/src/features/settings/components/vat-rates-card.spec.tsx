import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import { VAT_RATES_KEY } from "@/features/settings/api/vat-rates"
import type { VatRates } from "@/features/settings/api/vat-rates"
import { VatRatesCard } from "./vat-rates-card"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))

const rate = (id: string, value: number, extra: Partial<VatRates["rates"][number]> = {}) => ({
  id,
  code: `KDV${String(value)}`,
  name: `KDV %${String(value)}`,
  rate: value,
  product_type_id: `ptyp_${String(value)}`,
  product_type_name: `KDV %${String(value)}`,
  products: 0,
  active: true,
  ...extra,
})

const RATES: VatRates = {
  region_id: "txreg_1",
  default: { id: "txr_20", code: "KDV20", name: "KDV %20", rate: 20 },
  rates: [
    rate("txr_20", 20, { product_type_id: null, product_type_name: null, products: 12 }),
    rate("txr_10", 10, { products: 3 }),
    rate("txr_1", 1),
    rate("txr_8", 8.5, { name: "Eski oran", active: false }),
  ],
}

function renderCard({ owner = true } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(STAFF_KEY, {
    user_id: "user_1",
    role: owner ? "owner" : "admin",
    can: { vatRates: owner },
    mfa: { available: true, required: false, enabled: true, passed: true },
  })
  client.setQueryData(VAT_RATES_KEY, RATES)
  render(
    <QueryClientProvider client={client}>
      <VatRatesCard />
    </QueryClientProvider>
  )
}

const rowOf = (name: string) => {
  const row = screen.getByText(name).closest("tr")
  if (!row) {
    throw new Error(`no row for ${name}`)
  }
  return within(row)
}

const openMenu = async (name: string) => {
  await userEvent.click(screen.getByRole("button", { name: `${name} için işlemler` }))
}

describe("VatRatesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(RATES)
  })

  it("lists each rate with its percentage and products, the default and the removed marked", () => {
    renderCard()

    expect(rowOf("KDV %20").getByText("Varsayılan")).toBeInTheDocument()
    expect(rowOf("KDV %20").getByText("%20")).toBeInTheDocument()
    expect(rowOf("KDV %20").getByText("12")).toBeInTheDocument()
    expect(rowOf("KDV %10").getByText("3")).toBeInTheDocument()
    expect(rowOf("Eski oran").getByText("Kaldırıldı")).toBeInTheDocument()
    expect(rowOf("Eski oran").getByText("%8,5")).toBeInTheDocument()
    expect(screen.getByText(/Fiyatlar KDV dahil girilir/)).toBeInTheDocument()
  })

  it("adds a rate named after its percentage unless named by hand", async () => {
    renderCard()
    await userEvent.click(screen.getByRole("button", { name: "Oran ekle" }))
    const dialog = await screen.findByRole("dialog", { name: "KDV oranı ekle" })
    await userEvent.type(within(dialog).getByLabelText(/Oran/), "8,5")

    expect(within(dialog).getByLabelText(/^Ad/)).toHaveValue("KDV %8,5")
    await userEvent.click(within(dialog).getByRole("button", { name: "Oranı ekle" }))
    expect(fetchMock).toHaveBeenCalledWith("/admin/vat-rates", {
      method: "POST",
      body: { rate: 8.5, name: "KDV %8,5" },
    })
  })

  it("says why a rate in use or the default cannot be removed", async () => {
    renderCard()
    await openMenu("KDV %10")

    const remove = await screen.findByRole("menuitem", { name: /Kaldır/ })
    expect(remove).toHaveAttribute("aria-disabled", "true")
    expect(remove).toHaveTextContent("Bu oranda 3 ürün var")
    await userEvent.keyboard("{Escape}")
    await openMenu("KDV %20")
    expect(await screen.findByRole("menuitem", { name: /Kaldır/ })).toHaveTextContent(
      "Varsayılan oran kaldırılamaz"
    )
  })

  it("removes a rate no product is on after asking, and brings a removed one back", async () => {
    renderCard()
    await openMenu("KDV %1")
    await userEvent.click(await screen.findByRole("menuitem", { name: /Kaldır/ }))
    const confirm = await screen.findByRole("alertdialog", { name: "KDV %1 kaldırılsın mı?" })
    await userEvent.click(within(confirm).getByRole("button", { name: "Oranı kaldır" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/vat-rates/txr_1", {
      method: "POST",
      body: { active: false },
    })
    await openMenu("Eski oran")
    await userEvent.click(await screen.findByRole("menuitem", { name: "Geri al" }))
    expect(fetchMock).toHaveBeenCalledWith("/admin/vat-rates/txr_8", {
      method: "POST",
      body: { active: true },
    })
  })

  it("moves the default after saying what it changes", async () => {
    renderCard()
    await openMenu("KDV %10")
    await userEvent.click(await screen.findByRole("menuitem", { name: "Varsayılan yap" }))
    const confirm = await screen.findByRole("alertdialog", {
      name: "KDV %10 varsayılan olsun mu?",
    })

    expect(confirm).toHaveTextContent("KDV %20 ürünlerde seçilebilir bir oran olarak kalır")
    await userEvent.click(within(confirm).getByRole("button", { name: "Varsayılan yap" }))
    expect(fetchMock).toHaveBeenCalledWith("/admin/vat-rates/default", {
      method: "POST",
      body: { rate_id: "txr_10" },
    })
  })

  it("shows the rates without actions to a role that may not change them", () => {
    renderCard({ owner: false })

    expect(screen.queryByRole("button", { name: "Oran ekle" })).toBeNull()
    expect(screen.queryByRole("button", { name: /için işlemler/ })).toBeNull()
    expect(screen.getByText(/yalnızca mağaza sahibi değiştirebilir/)).toBeInTheDocument()
  })
})
