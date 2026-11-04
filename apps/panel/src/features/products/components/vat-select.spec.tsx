import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { VAT_RATES_KEY } from "@/features/settings/api/vat-rates"
import type { VatRates } from "@/features/settings/api/vat-rates"
import { VatSelect } from "./vat-select"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))

const RATES: VatRates = {
  region_id: "txreg_1",
  // The owner made %10 the default; %20 stays a rate to choose
  default: { id: "txr_10", code: "KDV10", name: "KDV %10", rate: 10 },
  rates: [
    {
      id: "txr_10",
      code: "KDV10",
      name: "KDV %10",
      rate: 10,
      product_type_id: "ptyp_10",
      product_type_name: "KDV %10",
      products: 4,
      active: true,
    },
    {
      id: "txr_20",
      code: "KDV20",
      name: "Genel",
      rate: 20,
      product_type_id: "ptyp_20",
      product_type_name: "Genel",
      products: 0,
      active: true,
    },
    {
      id: "txr_1",
      code: "KDV1",
      name: "KDV %1",
      rate: 1,
      product_type_id: "ptyp_1",
      product_type_name: "KDV %1",
      products: 0,
      active: false,
    },
  ],
}

function renderSelect(value: string, onChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  client.setQueryData(VAT_RATES_KEY, RATES)
  render(
    <QueryClientProvider client={client}>
      <VatSelect id="vat" value={value} onChange={onChange} />
    </QueryClientProvider>
  )
  return onChange
}

describe("VatSelect", () => {
  it("offers the default by today's rate and the rates in use, by name and percentage", async () => {
    const onChange = renderSelect("")

    expect(screen.getByRole("combobox")).toHaveTextContent("Varsayılan (KDV %10)")
    await userEvent.click(screen.getByRole("combobox"))
    const options = screen.getAllByRole("option").map((option) => option.textContent)
    expect(options).toEqual(["Varsayılan (KDV %10)", "KDV %10", "Genel (%20)"])
    await userEvent.click(screen.getByRole("option", { name: "Genel (%20)" }))
    expect(onChange).toHaveBeenCalledWith("ptyp_20")
  })

  it("shows a product on a removed rate's group as such", () => {
    renderSelect("ptyp_1")

    expect(screen.getByRole("combobox")).toHaveTextContent("Kaldırılmış oran")
  })
})
