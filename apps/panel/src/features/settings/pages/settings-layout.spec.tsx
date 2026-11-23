import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SettingsHomePage } from "./settings-home-page"
import { SettingsLayout } from "./settings-layout"

const path = vi.hoisted(() => ({ current: "/settings/sms/netgsm" }))
// What the signed-in role may (adr/0040): the owner unless a test says otherwise
const staff = vi.hoisted(() => ({ allowed: (capability: string) => capability !== "" }))

vi.mock("@/features/auth/api/staff", () => ({
  useCapabilities: () => staff.allowed,
}))

// Links as plain anchors and the address from the test: rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => {
    // activeOptions is the router's, not an attribute of the anchor
    const rest = Object.fromEntries(
      Object.entries(props).filter(([name]) => name !== "activeOptions")
    )
    return (
      <a href={to} {...rest}>
        {children}
      </a>
    )
  },
  Outlet: () => null,
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: path.current } }),
}))

describe("Settings menu", () => {
  it("shows every group open with its sections, the current page marked, and closes one on a click", async () => {
    render(<SettingsLayout />)

    const shop = screen.getByRole("button", { name: "Mağaza" })
    for (const name of ["Mağaza", "Satış ve teslimat", "İletişim ve pazarlama", "Sistem"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-expanded", "true")
    }
    // An SMS provider's page belongs to E-mail and SMS, where SMS is a tab
    expect(screen.getByRole("link", { name: "E-posta ve SMS" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("link", { name: "Görünüm" })).toHaveAttribute(
      "href",
      "/settings/appearance"
    )

    await userEvent.click(shop)
    expect(shop).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("link", { name: "Görünüm" })).toBeNull()
  })
})

describe("Settings home", () => {
  it("links every section under its group, with a line on what it holds", () => {
    render(<SettingsHomePage />)

    expect(screen.getByRole("heading", { name: "Satış ve teslimat" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Kargo ve teslimat.*depolar/ })).toHaveAttribute(
      "href",
      "/settings/shipping"
    )
    // F14: moving the shop in, the owner's
    expect(screen.getByRole("link", { name: /Taşıma.*301/ })).toHaveAttribute(
      "href",
      "/settings/migration"
    )
    // Accounting, warehouses and SMS are tabs of invoices, shipping and e-mail now; the
    // storefront's parts are under Storefront in the main menu (adr/0049)
    // adr/0061 Ek C14: Subscription joined the system group; maintenance came from the
    // storefront preferences (the owner, 2026-11-16)
    // adr/0071 §13: AI joined the system group
    // Ekip is a tab of Güvenlik and İşler one of Denetim kaydı (the owner, 2026-11-23)
    expect(screen.getAllByRole("link")).toHaveLength(19)
    expect(screen.queryByRole("link", { name: /^Ekip/ })).toBeNull()
    expect(screen.queryByRole("link", { name: /^İşler/ })).toBeNull()
    expect(screen.getByRole("link", { name: /Güvenlik.*ekip üyeleri/ })).toHaveAttribute(
      "href",
      "/settings/security"
    )
    expect(screen.getByRole("link", { name: /Yapay zekâ/ })).toHaveAttribute("href", "/settings/ai")
    expect(screen.getByRole("link", { name: /Bakım modu/ })).toHaveAttribute(
      "href",
      "/settings/maintenance"
    )
    expect(screen.getByRole("link", { name: /Abonelik.*limitler/ })).toHaveAttribute(
      "href",
      "/settings/subscription"
    )
    expect(screen.queryByRole("link", { name: /^Vitrin/ })).toBeNull()
  })

  it("offers operations staff only what they may use: no settings to change", () => {
    staff.allowed = (capability) => ["orders", "stock", "moderation"].includes(capability)
    render(<SettingsHomePage />)

    // Integrations show the shop's set-up and its failures: those who set it up (F12.2).
    // Maintenance shows them whether the storefront is dark, its switch read-only, as the
    // storefront preferences page did (adr/0053). Their jobs are under Denetim kaydı, whose
    // log they do not see (the owner, 2026-11-23)
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/settings/maintenance",
      "/settings/security",
      "/settings/audit",
    ])
    expect(screen.queryByRole("heading", { name: "Satış ve teslimat" })).toBeNull()
    staff.allowed = () => true
  })
})
