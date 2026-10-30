import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { Team } from "@/features/settings/api/team"
import { TeamPage } from "./team-page"

const fetchMock = vi.hoisted(() => vi.fn())
const staff = vi.hoisted(() => ({ manage: true }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => staff.manage }))
// Links as plain anchors: rendered without a router
vi.mock("@tanstack/react-router", () => ({ Link: () => null }))

const team: Team = {
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
    {
      id: "user_ops",
      email: "depo@example.com",
      first_name: null,
      last_name: null,
      created_at: "2026-10-28T09:00:00Z",
      role: "operations",
      you: false,
      mfa: true,
    },
  ],
  invites: [
    {
      id: "invite_1",
      email: "yeni@example.com",
      role: "readonly",
      expires_at: "2026-10-30T09:00:00Z",
      expired: false,
      created_at: "2026-10-29T09:00:00Z",
    },
  ],
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TeamPage />
    </QueryClientProvider>
  )
}

describe("TeamPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("gives the owner each member's role to change, the invitations and a way to invite", async () => {
    staff.manage = true
    fetchMock.mockResolvedValue(team)
    renderPage()

    const [members] = await screen.findAllByRole("list")
    if (!members) {
      throw new Error("no member list")
    }
    expect(within(members).getAllByRole("combobox")).toHaveLength(2)
    expect(screen.getByText("Siz")).toBeInTheDocument()
    // Nobody removes themselves: only the other member has the button
    expect(screen.getAllByRole("button", { name: /ekipten çıkar/ })).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Davet et" })).toBeInTheDocument()
    // Another's 2FA, for a phone lost; one's own goes through Settings > Security
    expect(screen.getAllByRole("button", { name: /2FA'yı sıfırla/ })).toHaveLength(1)
    expect(screen.getAllByText("2FA açık")).toHaveLength(2)
    expect(screen.getByText("yeni@example.com")).toBeInTheDocument()
  })

  it("shows an admin the team, its roles as they are", async () => {
    staff.manage = false
    fetchMock.mockResolvedValue({ ...team, invites: null })
    renderPage()

    expect(await screen.findByText("Operasyon")).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).toBeNull()
    expect(screen.queryByRole("button", { name: "Davet et" })).toBeNull()
    expect(screen.queryByText("Bekleyen davetler")).toBeNull()
  })
})
