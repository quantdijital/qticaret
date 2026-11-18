import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { invoicingProviderOf } from "@/features/settings/api/einvoice"
import type { InvoicingSettings } from "@/features/settings/api/einvoice"
import { EinvoiceProgramCard } from "./einvoice-program-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const settings = (provider: string): InvoicingSettings => ({
  // A development database may still hold the test program picked before it was taken out
  provider: provider as InvoicingSettings["provider"],
  trigger: "placed",
  carriers: {},
  series: null,
})

const parasut = (available: boolean) => ({
  parasut: { available, authorize_url: null, connection: null },
})

let client: QueryClient

const renderCard = (provider: string) => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <EinvoiceProgramCard saved={settings(provider)} />
    </QueryClientProvider>
  )
}

// Paraşüt's state read: the select is opened once it is known
const settled = () =>
  waitFor(() => {
    expect(client.getQueryData(["einvoice", "parasut"])).toBeDefined()
  })

const options = async () => {
  await userEvent.click(screen.getByRole("combobox", { name: "Faturayı kesen" }))
  return (await screen.findAllByRole("option")).map((option) => option.textContent)
}

describe("EinvoiceProgramCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(parasut(true))
  })

  it("reads a program the panel does not offer as none", () => {
    expect(invoicingProviderOf("fake")).toBe("none")
    expect(invoicingProviderOf("parasut")).toBe("parasut")
    expect(invoicingProviderOf("external")).toBe("external")
    expect(invoicingProviderOf("birfatura")).toBe("birfatura")
  })

  it("shows an old test program as no program, and never offers it", () => {
    renderCard("fake")

    expect(screen.getByRole("combobox", { name: "Faturayı kesen" })).toHaveTextContent("Kapalı")
    expect(screen.getByText(/Fatura kesilmez\./)).toBeInTheDocument()
    expect(screen.queryByText(/Sahte|geliştirme/)).toBeNull()
  })

  it("offers Paraşüt once the platform has opened it", async () => {
    renderCard("none")
    await settled()

    expect(await options()).toEqual([
      "Kapalı",
      "Paraşüt",
      "BirFatura",
      "Kendi programım (geri yazma)",
    ])
  })

  it("offers BirFatura, with the web sales series its numbers are held to", async () => {
    const user = userEvent.setup()
    renderCard("none")
    await settled()

    await user.click(screen.getByRole("combobox", { name: "Faturayı kesen" }))
    await user.click(await screen.findByRole("option", { name: "BirFatura" }))

    expect(screen.getByLabelText("Web satış serisi")).toBeInTheDocument()
    expect(screen.getByText(/BirFatura siparişleri mağazanızdan çeker/)).toBeInTheDocument()
    expect(screen.getByText(/bağlantı şifresi silinir/)).toBeInTheDocument()
  })

  it("does not offer Paraşüt while the platform has not opened it (docs/06 principle 10)", async () => {
    fetchMock.mockResolvedValue(parasut(false))
    renderCard("none")
    await settled()

    expect(await options()).toEqual(["Kapalı", "BirFatura", "Kendi programım (geri yazma)"])
  })

  it("keeps a shop already on Paraşüt seeing its choice", () => {
    fetchMock.mockResolvedValue(parasut(false))
    renderCard("parasut")

    expect(screen.getByRole("combobox", { name: "Faturayı kesen" })).toHaveTextContent("Paraşüt")
  })
})
