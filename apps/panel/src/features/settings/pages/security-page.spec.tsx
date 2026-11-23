import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SecurityPage } from "./security-page"

const search = vi.hoisted((): { current: { part?: string } } => ({ current: {} }))
// What the signed-in role may (adr/0040)
const staff = vi.hoisted(() => ({ can: new Set<string>() }))

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => search.current,
  useNavigate: () => vi.fn(),
}))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: (capability: string) => staff.can.has(capability),
}))
// The cards have their own tests: here only which ones each tab holds
vi.mock("@/features/settings/components/team-section", () => ({
  TeamSection: () => <p>team members</p>,
}))
vi.mock("@/features/settings/components/team-mfa-card", () => ({
  TeamMfaCard: () => <p>team 2fa</p>,
}))
vi.mock("@/features/settings/components/my-profile-card", () => ({ MyProfileCard: () => null }))
vi.mock("@/features/settings/components/my-sign-in-card", () => ({ MySignInCard: () => null }))
vi.mock("@/features/settings/components/my-mfa-card", () => ({ MyMfaCard: () => null }))
vi.mock("@/features/settings/components/fraud-rules-card", () => ({ FraudRulesCard: () => null }))
vi.mock("@/features/settings/components/fraud-blocks-card", () => ({
  FraudBlocksCard: () => null,
}))

describe("SecurityPage's Ekip tab (the owner, 2026-11-23)", () => {
  beforeEach(() => {
    search.current = { part: "team" }
    staff.can = new Set()
  })

  it("holds the members and invitations for a role that may see the team, and the 2FA rule", () => {
    staff.can = new Set(["team"])
    render(<SecurityPage />)

    expect(screen.getByRole("tab", { name: "Ekip" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("team members")).toBeInTheDocument()
    expect(screen.getByText("team 2fa")).toBeInTheDocument()
  })

  it("keeps the members from a role that may not, as the Ekip page did", () => {
    render(<SecurityPage />)

    expect(screen.queryByText("team members")).toBeNull()
    expect(screen.getByText("team 2fa")).toBeInTheDocument()
  })
})
