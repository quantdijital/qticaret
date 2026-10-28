import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { IysCard } from "./iys-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <IysCard />
    </QueryClientProvider>
  )
}

describe("IysCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("says the consents wait while there is no brand code", async () => {
    fetchMock.mockResolvedValue({
      iys: { brand_code_set: false, pending: 12, sent: 0, failed: 0 },
    })
    renderCard()

    expect(await screen.findByText(/marka kodu girilmedi/)).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
  })

  it("shows what reached İYS once the brand code is set", async () => {
    fetchMock.mockResolvedValue({
      iys: { brand_code_set: true, pending: 0, sent: 1530, failed: 2 },
    })
    renderCard()

    expect(await screen.findByText("1.530")).toBeInTheDocument()
    expect(screen.queryByText(/marka kodu girilmedi/)).not.toBeInTheDocument()
  })
})
