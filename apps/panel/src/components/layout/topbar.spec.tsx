import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STOREFRONT_ORIGIN } from "@/features/storefront/layout/preview-url"
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
const seo = vi.hoisted(() => ({
  host: null as string | null,
  served: undefined as string | null | undefined,
}))
vi.mock("@/features/settings/api/seo", () => ({
  seoSettingsQuery: () => ({
    queryKey: ["seo"],
    queryFn: () => ({ values: { canonical_host: seo.host }, storefront_url: seo.served }),
  }),
}))
vi.mock("@qticaret/admin-ui/ui/sidebar", () => ({ SidebarTrigger: () => null }))
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

describe("Topbar's 'Mağazayı görüntüle'", () => {
  beforeEach(() => {
    seo.host = null
    seo.served = undefined
  })

  it("opens the bound domain in a new tab", async () => {
    seo.host = "magaza.example.com"
    renderTopbar()
    // Its name starts with the words it shows, and says where it opens
    const link = await screen.findByRole("link", {
      name: "Mağazayı görüntüle (yeni sekmede açılır)",
    })
    expect(link).toHaveTextContent("Mağazayı görüntüle")
    expect(link).toHaveAttribute("href", "https://magaza.example.com")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("opens the bound domain before the address the backend gives", async () => {
    seo.host = "magaza.example.com"
    seo.served = "https://vitrin.example.net"
    renderTopbar()
    const link = await screen.findByRole("link", { name: /Mağazayı görüntüle/ })
    expect(link).toHaveAttribute("href", "https://magaza.example.com")
  })

  it("opens the address the backend gives while no domain is bound", async () => {
    seo.served = "https://vitrin.example.net"
    renderTopbar()
    const link = await screen.findByRole("link", { name: /Mağazayı görüntüle/ })
    expect(link).toHaveAttribute("href", "https://vitrin.example.net")
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("never opens an address out of shape the backend's answer holds", async () => {
    seo.served = "javascript:alert(1)"
    renderTopbar()
    const link = await screen.findByRole("link", { name: /Mağazayı görüntüle/ })
    // While developing, the storefront the panel frames stands in
    expect(link).toHaveAttribute("href", STOREFRONT_ORIGIN)
  })

  it("opens the storefront the panel already frames while developing and nothing else is known", async () => {
    // The development default or `VITE_STOREFRONT_ORIGIN`: never made up here
    expect(STOREFRONT_ORIGIN).toMatch(/^https?:\/\//)
    renderTopbar()
    const link = await screen.findByRole("link", { name: /Mağazayı görüntüle/ })
    expect(link).toHaveAttribute("href", STOREFRONT_ORIGIN)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })
})

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
