import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { planOf } from "@/features/settings/plan.fixtures"
import { TeamPage } from "./team-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

const team = {
  staff: [
    {
      id: "user_owner",
      email: "deniz@example.com",
      first_name: "Deniz",
      last_name: "Kaya",
      created_at: "2026-10-24T09:00:00Z",
      role: "owner",
      you: true,
      mfa: true,
    },
  ],
  invites: [],
}

function renderPage(seats: { used: number; max: number }) {
  fetchMock.mockImplementation((path: string) =>
    Promise.resolve(path === "/admin/plan" ? { plan: planOf({}, { staff: seats }) } : team)
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TeamPage />
    </QueryClientProvider>
  )
}

describe("TeamPage at the package's team limit (adr/0061 Ek C14)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("holds the invite button back and says why, with a link to the subscription", async () => {
    renderPage({ used: 3, max: 3 })

    const notice = await screen.findByRole("status")
    const invite = screen.getByRole("button", { name: "Davet et" })
    expect(notice).toHaveTextContent("Ekip limitinize ulaştınız (3/3")
    expect(invite).toBeDisabled()
    expect(invite).toHaveAccessibleDescription(/Ekip limitinize ulaştınız/)
    expect(screen.getByRole("link", { name: "Aboneliği gör" })).toHaveAttribute(
      "href",
      "/settings/subscription"
    )
  })

  it("only warns near it, the button still there", async () => {
    renderPage({ used: 8, max: 10 })

    expect(await screen.findByRole("status")).toHaveTextContent("Ekip limitinize yaklaştınız")
    expect(screen.getByRole("button", { name: "Davet et" })).toBeEnabled()
  })
})
