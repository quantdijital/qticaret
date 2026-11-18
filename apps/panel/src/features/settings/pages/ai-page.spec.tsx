import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, renderHook, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AiServicesAnswer, AiUsageAnswer } from "@/features/ai/api/ai"
import { useAlertText } from "@/features/notifications/alert-text"
import { formatEstimate } from "@/features/ai/format"
import { AiPage } from "./ai-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: () => true,
  useStaff: () => ({ role: "owner" }),
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}))

const services = (ownKeys: boolean): AiServicesAnswer => ({
  services: ["deepseek", "minimax", "gemini"].map((id) => ({
    id,
    capabilities: ["text"],
    status: id === "deepseek" ? "connected" : "not_connected",
    funding: "own_key",
    data_note_key: `ai.data_note.${id}`,
  })),
  tasks: [],
  flags: { own_keys: ownKeys },
})

const usage: AiUsageAnswer = {
  month: "2026-11",
  services: [
    {
      id: "deepseek",
      count: 12,
      succeeded: 10,
      refused: 1,
      failed: 1,
      estimated_cost_micros: { USD: 4_200 },
    },
  ],
  tasks: [
    { id: "test_text", count: 12, succeeded: 10, refused: 1, failed: 1, estimated_cost_micros: {} },
  ],
  monthly: { used: 12, limit: 100 },
  daily: {
    text: { used: 3, limit: 500 },
    image: { used: 0, limit: 100 },
    video: { used: 0, limit: 10 },
  },
}

function serve(ownKeys: boolean) {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/admin/ai/services") {
      return Promise.resolve(services(ownKeys))
    }
    if (url === "/admin/ai/usage") {
      return Promise.resolve(usage)
    }
    return Promise.resolve({ key_configured: true, accounts: [] })
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AiPage />
    </QueryClientProvider>
  )
}

describe("AiPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("a card for each service, each with its own data note, and the month's use", async () => {
    serve(true)
    renderPage()
    expect(await screen.findByRole("heading", { name: "DeepSeek" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "MiniMax" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Gemini" })).toBeInTheDocument()
    expect(screen.getByText(/Veri Çin'de işlenir/)).toBeInTheDocument()
    expect(screen.getByText(/ücretli kullanımda kullanmaz/)).toBeInTheDocument()
    expect(screen.getByText(/belirtilmemiş/)).toBeInTheDocument()
    expect(screen.getAllByText(/Kişisel veri gönderilmez/)).toHaveLength(3)
    expect(await screen.findByText("Deneme metni")).toBeInTheDocument()
    expect(screen.getByText("12 / 100")).toBeInTheDocument()
    expect(screen.getByText(/Maliyet tahminidir/)).toBeInTheDocument()
    expect(screen.queryByText(/Paketiniz kendi anahtarınızla/)).toBeNull()
  })

  it("says when the package leaves the shop's own key out", async () => {
    serve(false)
    renderPage()
    expect(await screen.findByText(/Paketiniz kendi anahtarınızla/)).toBeInTheDocument()
    for (const connect of screen.getAllByRole("button", { name: "Bağla" })) {
      expect(connect).toBeDisabled()
    }
  })
})

describe("formatEstimate", () => {
  it("shows a small estimate to its first figures and none as a dash", () => {
    expect(formatEstimate({ USD: 4_200 })).toMatch(/0,0042/)
    expect(formatEstimate({ USD: 1_250_000 })).toMatch(/1,25/)
    expect(formatEstimate({})).toBe("—")
  })
})

describe("the bell's account alert", () => {
  it("names an AI service in words and leads to its settings", () => {
    const { result } = renderHook(() =>
      useAlertText({ kind: "provider_account", provider: "deepseek", changes: ["connected"] })
    )
    expect(result.current.title).toBe("DeepSeek hesap bilgileri değişti")
    expect(result.current.link?.to).toBe("/settings/ai")
  })
})
