import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, renderHook, screen, waitFor, within } from "@testing-library/react"
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
  // The page's first tab (the services) opens; the writing guidance is the second
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
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

const unused: AiUsageAnswer = {
  ...usage,
  services: [],
  tasks: [],
  monthly: { used: 0, limit: 100 },
}

function serve(ownKeys: boolean, { used = true, keyConfigured = true } = {}) {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/admin/ai/services") {
      return Promise.resolve(services(ownKeys))
    }
    if (url === "/admin/ai/usage") {
      return Promise.resolve(used ? usage : unused)
    }
    if (url === "/admin/features") {
      return Promise.resolve({
        features: [{ key: "ai.reviews", default: false, owner: "tenant", enabled: false }],
      })
    }
    return Promise.resolve({ key_configured: keyConfigured, accounts: [] })
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

  it("a row for each service, each with its own data note behind the (i)", async () => {
    serve(true)
    renderPage()
    const table = await screen.findByRole("table", { name: "Servisler" })
    expect(within(table).getByRole("columnheader", { name: "Servis" })).toBeInTheDocument()
    for (const name of ["DeepSeek", "MiniMax", "Gemini"]) {
      expect(within(table).getByRole("row", { name: new RegExp(name) })).toBeInTheDocument()
    }
    const note = (name: string) =>
      screen.getByRole("button", { name: `Bilgi: ${name} verisi nereye gider` })
    expect(note("DeepSeek")).toHaveAccessibleDescription(/Veri Çin'de işlenir/)
    expect(note("Gemini")).toHaveAccessibleDescription(/ücretli kullanımda kullanmaz/)
    expect(note("MiniMax")).toHaveAccessibleDescription(/belirtilmemiş/)
    for (const name of ["DeepSeek", "MiniMax", "Gemini"]) {
      expect(note(name)).toHaveAccessibleDescription(/Kişisel veri gönderilmez/)
    }
    // Only the connected one has a menu; the others are a Bağla each
    expect(screen.getByRole("button", { name: "DeepSeek işlemleri" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Bağla" })).toHaveLength(2)
    expect(screen.queryByText(/Paketiniz kendi anahtarınızla/)).toBeNull()
    // The credits off (this stand-in answers no wallet): no trace of them
    expect(screen.queryByRole("heading", { name: "Platform kredisi" })).toBeNull()
  })

  it("keeps the platform's credits out of the key table, in a card of their own", async () => {
    serve(true)
    const base = fetchMock.getMockImplementation()
    fetchMock.mockImplementation((url: string) => {
      if (url === "/admin/ai/services") {
        const answer = services(true)
        answer.services.push({
          id: "platform",
          capabilities: ["text"],
          status: "connected",
          funding: "platform_credit",
          data_note_key: "ai.data_note.platform",
        })
        return Promise.resolve(answer)
      }
      if (url === "/admin/ai/credits") {
        return Promise.resolve({
          available: true,
          plan: { remaining: 40, renews_on: "2026-12-01" },
          purchased: { remaining: 0, expires_on: null },
          daily: { cap: 300, remaining: 300 },
          tasks: { seo_title: 1 },
          packs: [],
          pending_order: null,
        })
      }
      return (base as (url: string) => Promise<unknown>)(url)
    })
    renderPage()
    expect(await screen.findByRole("heading", { name: "Platform kredisi" })).toBeInTheDocument()
    const table = screen.getByRole("table", { name: "Servisler" })
    expect(within(table).queryByRole("row", { name: /Platform kredisi/ })).toBeNull()
  })

  it("the reviews switch is a line, its words behind the (i)", async () => {
    serve(true)
    renderPage()
    const toggle = await screen.findByRole("switch", { name: "Yorum ve sorularda yapay zekâ" })
    expect(toggle).toHaveAccessibleDescription(/yanıt taslağı hazırlar.*Yazarın adı/)
    expect(
      screen.getByRole("button", { name: "Bilgi: Yorum ve sorularda yapay zekâ" })
    ).toBeInTheDocument()
    // Kept for a screen reader and the search, not shown
    expect(screen.getByText(/Taslak siz göndermeden yayımlanmaz/)).toHaveClass("sr-only")
  })

  it("the month's use: a small table, the ceilings beside the title, the notes behind (i)", async () => {
    serve(true)
    renderPage()
    expect(await screen.findByText("Deneme metni")).toBeInTheDocument()
    expect(screen.getByRole("rowheader", { name: "DeepSeek" })).toBeInTheDocument()
    expect(screen.getByText("12 / 100")).toBeInTheDocument()
    expect(screen.getByText("3 / 500")).toBeInTheDocument()
    // By service and by task
    expect(screen.getAllByText("2 tanesi sonuç vermedi")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Bilgi: Bu ayki kullanım" })).toBeInTheDocument()
    expect(screen.queryByText(/Maliyet, servislerin liste fiyatlarından/)).toBeNull()
  })

  it("the month's use, none yet: one line", async () => {
    serve(true, { used: false })
    renderPage()
    expect(await screen.findByText("Bu ay yapay zekâ henüz kullanılmadı.")).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "Tahmini maliyet" })).toBeNull()
    expect(screen.getByText("0 / 100")).toBeInTheDocument()
  })

  it.each([
    ["spent", { calls: 7, credits: 1_250 }, "Bu ay platform kredisinden 1.250 kredi harcandı."],
    ["none spent", { calls: 0, credits: 0 }, null],
    ["a server without the field", undefined, null],
  ])("the platform's credits under the table: %s", async (_, credits, line) => {
    serve(true)
    const base = fetchMock.getMockImplementation() as (url: string) => Promise<unknown>
    fetchMock.mockImplementation((url: string) =>
      url === "/admin/ai/usage"
        ? Promise.resolve({ ...usage, platform_credits: credits })
        : base(url)
    )
    renderPage()
    expect(await screen.findByText("Deneme metni")).toBeInTheDocument()
    if (line) {
      expect(screen.getByText(line)).toBeInTheDocument()
    } else {
      expect(screen.queryByText(/platform kredisinden/)).toBeNull()
    }
  })

  it("says when the package leaves the shop's own key out", async () => {
    serve(false)
    renderPage()
    expect(await screen.findByText(/Paketiniz kendi anahtarınızla/)).toBeInTheDocument()
    for (const connect of screen.getAllByRole("button", { name: "Bağla" })) {
      expect(connect).toBeDisabled()
    }
  })

  it("says once, above the table, when the server cannot keep a key", async () => {
    serve(true, { keyConfigured: false })
    renderPage()
    expect(await screen.findByText(/şifreleme anahtarı tanımlı değil/)).toBeInTheDocument()
    await waitFor(() => {
      for (const connect of screen.getAllByRole("button", { name: "Bağla" })) {
        expect(connect).toBeDisabled()
      }
    })
    expect(screen.getAllByText(/şifreleme anahtarı tanımlı değil/)).toHaveLength(1)
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
