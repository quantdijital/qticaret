import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SettingsHomePage } from "./settings-home-page"
import { SettingsLayout } from "./settings-layout"

const path = vi.hoisted(() => ({ current: "/settings/sms/netgsm" }))

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
    for (const name of ["Mağaza", "Satış ve teslimat", "Müşteri iletişimi", "Sistem"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-expanded", "true")
    }
    expect(screen.getByRole("link", { name: "SMS" })).toHaveAttribute("aria-current", "page")
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
    expect(screen.getByRole("link", { name: /Kargo.*Kargo firmaları/ })).toHaveAttribute(
      "href",
      "/settings/shipping"
    )
    expect(screen.getAllByRole("link")).toHaveLength(14)
  })
})
