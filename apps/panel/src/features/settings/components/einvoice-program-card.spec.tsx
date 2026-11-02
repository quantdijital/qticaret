import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { invoicingProviderOf } from "@/features/settings/api/einvoice"
import type { InvoicingSettings } from "@/features/settings/api/einvoice"
import { EinvoiceProgramCard } from "./einvoice-program-card"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const settings = (provider: string): InvoicingSettings => ({
  // A development database may still hold the test program picked before it was taken out
  provider: provider as InvoicingSettings["provider"],
  trigger: "placed",
  carriers: {},
  series: null,
})

const renderCard = (provider: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EinvoiceProgramCard saved={settings(provider)} />
    </QueryClientProvider>
  )

describe("EinvoiceProgramCard", () => {
  it("reads a program the panel does not offer as none", () => {
    expect(invoicingProviderOf("fake")).toBe("none")
    expect(invoicingProviderOf("parasut")).toBe("parasut")
    expect(invoicingProviderOf("external")).toBe("external")
  })

  it("shows an old test program as no program, and never offers it", () => {
    renderCard("fake")

    expect(screen.getByRole("combobox", { name: "Faturayı kesen" })).toHaveTextContent("Kapalı")
    expect(screen.getByText(/Fatura kesilmez\./)).toBeInTheDocument()
    expect(screen.queryByText(/Sahte|geliştirme/)).toBeNull()
  })
})
