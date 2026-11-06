import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { Topbar } from "./topbar"

const staff = vi.hoisted(() => ({ current: { role: "owner", can: { settings: true } } }))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock("@/features/auth/api/me", () => ({
  useCurrentUser: () => ({ first_name: "Deniz", last_name: "Yılmaz", email: "deniz@example.com" }),
  useLogout: () => ({ mutate: vi.fn() }),
}))
vi.mock("@/features/auth/api/staff", () => ({ useStaff: () => staff.current }))
vi.mock("@/features/settings/api/seo", () => ({
  seoSettingsQuery: () => ({ queryKey: ["seo"], queryFn: () => ({ values: {} }) }),
}))
vi.mock("@/components/ui/sidebar", () => ({ SidebarTrigger: () => null }))
vi.mock("@/features/notifications/notification-bell", () => ({ NotificationBell: () => null }))
vi.mock("./command-menu", () => ({ CommandMenu: () => null }))

function renderTopbar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Topbar />
    </QueryClientProvider>
  )
}

describe("Topbar account menu", () => {
  beforeEach(() => {
    staff.current = { role: "owner", can: { settings: true } }
  })

  it("offers the store settings, opening the page that lists every setting", async () => {
    renderTopbar()
    await userEvent.click(screen.getByRole("button", { name: "Hesap" }))

    expect(await screen.findByRole("menuitem", { name: "Mağaza ayarları" })).toHaveAttribute(
      "href",
      "/settings"
    )
    expect(screen.getByRole("menuitem", { name: "Güvenlik" })).toHaveAttribute(
      "href",
      "/settings/security"
    )
    expect(screen.queryByRole("menuitem", { name: "Görünüm ayarları" })).toBeNull()
  })

  it("leaves the store settings out for a role that may not change them", async () => {
    staff.current = { role: "readonly", can: { settings: false } }
    renderTopbar()
    await userEvent.click(screen.getByRole("button", { name: "Hesap" }))

    expect(await screen.findByRole("menuitem", { name: "Güvenlik" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Mağaza ayarları" })).toBeNull()
  })
})
