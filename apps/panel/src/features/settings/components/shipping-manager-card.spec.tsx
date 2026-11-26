import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ShippingManager } from "@/features/settings/api/sections"
import { ShippingManagerCard } from "./shipping-manager-card"

const fetchMock = vi.hoisted(() => vi.fn())
const staff = vi.hoisted(() => ({ role: "owner" }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/auth/api/staff", () => ({ useStaff: () => staff }))
// The link to E-Fatura's settings, without the router around it
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/settings/einvoice">{children}</a>,
}))

const renderCard = (saved: ShippingManager, connected: boolean) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ShippingManagerCard saved={saved} connected={connected} />
    </QueryClientProvider>
  )
}

const birfatura = () => screen.getByRole("radio", { name: /^BirFatura/ })

describe("ShippingManagerCard (adr/0072 Ek 2026-11-26)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    staff.role = "owner"
  })

  it("asks one question, the shop's own contract by default", () => {
    renderCard("own", true)

    expect(screen.getByText("Kargoyu nereden yönetiyorsun?")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Kendi anlaşmam/ })).toBeChecked()
    expect(birfatura()).not.toBeChecked()
  })

  it("says why BirFatura cannot be picked yet, and where to connect it", () => {
    renderCard("own", false)

    expect(birfatura()).toBeDisabled()
    expect(screen.getByTestId("shipping-manager-why")).toHaveTextContent(/E-Fatura/)
    expect(screen.getByRole("link", { name: "E-Fatura ayarlarına git" })).toBeInTheDocument()
  })

  it("saves BirFatura once connected, and says what changes", async () => {
    fetchMock.mockResolvedValue({ section: "shipping", values: { manager: "birfatura" } })
    renderCard("own", true)

    await userEvent.click(birfatura())
    expect(screen.getByText(/takip numarasını yazınca/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/platform-settings/shipping",
        expect.objectContaining({ method: "POST", body: { manager: "birfatura" } })
      )
    })
  })

  it("is the owner's to change alone", () => {
    staff.role = "admin"
    renderCard("own", true)

    expect(birfatura()).toBeDisabled()
    expect(screen.getByText("Bunu yalnız mağaza sahibi değiştirebilir.")).toBeInTheDocument()
  })
})
