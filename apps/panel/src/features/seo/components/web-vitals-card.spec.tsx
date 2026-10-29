import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { WebVitalsCard } from "./web-vitals-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <WebVitalsCard />
    </QueryClientProvider>
  )
}

describe("WebVitalsCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("grades each metric against Google's lines, and says when CrUX has too little", async () => {
    fetchMock.mockResolvedValue({
      insights: {
        search: null,
        index: { inspected: 0, indexed: 0 },
        runs: [],
        vitals: [
          {
            form_factor: "PHONE",
            has_data: true,
            lcp_ms: 3200,
            inp_ms: 150,
            cls: 0.3,
            collected_at: "2026-10-29T02:30:00Z",
          },
          {
            form_factor: "DESKTOP",
            has_data: false,
            lcp_ms: null,
            inp_ms: null,
            cls: null,
            collected_at: "2026-10-29T02:30:00Z",
          },
        ],
      },
    })
    renderCard()

    expect(await screen.findByText("3.2 sn")).toBeInTheDocument()
    expect(screen.getByText("150 ms")).toBeInTheDocument()
    expect(screen.getByText("0.30")).toBeInTheDocument()
    expect(screen.getByText("CrUX'ta yeterli ziyaret yok.")).toBeInTheDocument()
  })
})
