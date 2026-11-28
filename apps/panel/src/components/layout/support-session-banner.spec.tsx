import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import { SupportSessionBanner } from "./support-session-banner"

const fetchMock = vi.hoisted(() => vi.fn<(url: string) => Promise<unknown>>())
const logout = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@/features/auth/api/me", () => ({
  useLogout: () => ({ mutate: logout, isPending: false }),
}))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))

const NOW = Date.UTC(2026, 10, 28, 10, 0, 0)

/** `GET /admin/staff/me`: a support session ending `minutes` from now, or a member's. */
const me = (minutes: number | null) => ({
  user_id: minutes === null ? "user_1" : "qtsup_x",
  role: "admin",
  can: {},
  mfa: { available: true, required: false, enabled: false, passed: true },
  ...(minutes === null
    ? {}
    : {
        support: {
          operator_name: "Ayşe Yılmaz",
          reason: "Ana sayfa kurulumu",
          started_at: new Date(NOW).toISOString(),
          expires_at: new Date(NOW + minutes * 60_000).toISOString(),
        },
      }),
})

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SupportSessionBanner />
    </QueryClientProvider>
  )
  return client
}

const settled = async (client: QueryClient) => {
  await vi.waitFor(() => {
    expect(client.getQueryState(STAFF_KEY)?.status).toBe("success")
  })
}

describe("SupportSessionBanner (adr/0061 Ek Destek erişimi)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(NOW)
    fetchMock.mockReset()
    logout.mockReset()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("names the support person and the minutes left, and ends the session on request", async () => {
    fetchMock.mockResolvedValue(me(42))
    await settled(renderBanner())

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Platform desteği olarak giriş yaptınız (Ayşe Yılmaz)"
    )
    expect(screen.getByRole("status")).toHaveTextContent("Kalan süre 42 dk")
    fireEvent.click(screen.getByRole("button", { name: "Oturumu bitir" }))
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it("shows nothing to a member of the team", async () => {
    fetchMock.mockResolvedValue(me(null))
    await settled(renderBanner())

    expect(screen.queryByRole("status")).toBeNull()
  })

  it("signs out once the session's time is up", async () => {
    fetchMock.mockResolvedValue(me(0))
    await settled(renderBanner())

    await vi.waitFor(() => {
      expect(logout).toHaveBeenCalled()
    })
  })
})
