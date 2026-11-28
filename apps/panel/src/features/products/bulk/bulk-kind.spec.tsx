import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BulkPreview } from "@/features/products/api/bulk"
import { featuresQuery } from "@/features/settings/api/features"
import { EMPTY_BULK_FORM } from "./bulk-form"
import type { BulkForm } from "./bulk-form"
import { BulkPreviewResult } from "./bulk-job-result"
import { BulkKindFields } from "./bulk-kind-fields"

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: vi.fn(() => new Promise(() => undefined)) } },
}))

function withFlags(booking: boolean, children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(featuresQuery().queryKey, [
    { key: "catalog.non_physical", default: false, owner: "tenant", enabled: true },
    { key: "catalog.booking", default: false, owner: "tenant", enabled: booking },
  ])
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>)
}

const fields = (patch: Partial<BulkForm>, booking = true) =>
  withFlags(
    booking,
    <BulkKindFields form={{ ...EMPTY_BULK_FORM, ...patch }} onChange={vi.fn()} error={null} />
  )

const preview = (patch: Partial<BulkPreview>): BulkPreview => ({
  products: 3,
  changed: 3,
  unchanged: 0,
  skipped: 0,
  problems: [],
  ...patch,
})

describe("bulk edit: product type", () => {
  it("offers the three types, and dated sale only for a service while booking is on", () => {
    fields({})
    const types = screen.getByRole("radiogroup", { name: "Ürün türü" })
    expect(types).toHaveTextContent("Fiziksel ürün")
    expect(screen.queryByRole("radiogroup", { name: "Rezervasyon" })).not.toBeInTheDocument()
  })

  it("asks how a service is booked", () => {
    fields({ kind: "service" })
    expect(screen.getByRole("radiogroup", { name: "Rezervasyon" })).toHaveTextContent(
      "Tarihli satış (kalkışlı)"
    )
  })

  it("does not offer dated sale with booking off", () => {
    fields({ kind: "service" }, false)
    expect(screen.queryByRole("radiogroup", { name: "Rezervasyon" })).not.toBeInTheDocument()
  })

  it("warns before dated products leave dated sale, as the product page does", () => {
    render(<BulkPreviewResult preview={preview({ booking_off: 2 })} />)
    expect(screen.getByRole("alert")).toHaveTextContent("2 tarihli ürün tarihli satıştan çıkacak.")
    expect(screen.getByRole("alert")).toHaveTextContent(/Stok takibi kendiliğinden açılmaz/)
  })

  it("says nothing when no dated product is touched", () => {
    render(<BulkPreviewResult preview={preview({ booking_off: 0 })} />)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
