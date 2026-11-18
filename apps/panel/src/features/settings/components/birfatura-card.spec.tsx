import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BirfaturaStatus } from "@/features/settings/api/einvoice"
import { setReauthAsker } from "@/lib/reauth"
import { EinvoiceConnectionCard } from "./parasut-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({ Link: () => null }))

const STATUS = "/admin/einvoice/birfatura"
const MAKE = "/admin/einvoice/birfatura/token"
// The shape BirFatura asks for; made up for the test, never a stored value
const PASSWORD = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0"

const NONE: BirfaturaStatus = { token: null, last_pull: null }
const MADE: BirfaturaStatus = {
  token: { state: "active", made_at: "2026-11-18T09:30:00.000Z" },
  last_pull: null,
}
const PULLED: BirfaturaStatus = {
  ...MADE,
  last_pull: { at: "2026-11-18T10:15:00.000Z", orders: 3 },
}

const refused = (status: number) => Object.assign(new Error("refused"), { status })

/** The backend: the card's state, the staff member, and the password route (`make`). */
function serve(
  status: BirfaturaStatus,
  role = "owner",
  make: () => Promise<unknown> = () => Promise.resolve({ token: PASSWORD, birfatura: MADE })
) {
  fetchMock.mockImplementation((url: string) =>
    url === STATUS
      ? Promise.resolve({ birfatura: status })
      : url === "/admin/staff/me"
        ? Promise.resolve({ role, can: {} })
        : url === MAKE
          ? make()
          : Promise.resolve({})
  )
}

const makes = () => fetchMock.mock.calls.filter(([url]) => url === MAKE)

const renderCard = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <EinvoiceConnectionCard provider="birfatura" />
    </QueryClientProvider>
  )

describe("EinvoiceConnectionCard (BirFatura)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.mocked(toast.success).mockReset()
  })
  afterEach(() => {
    setReauthAsker(null)
  })

  it("shows the site address to paste into BirFatura, with a copy button, and BirFatura's steps", async () => {
    const user = userEvent.setup()
    serve(NONE)
    renderCard()

    const site = await screen.findByRole("textbox", { name: "Site adresi" })
    expect(site).toHaveValue(`${window.location.origin}/hooks/birfatura`)
    await user.click(screen.getByRole("button", { name: "Adresi kopyala" }))
    await expect(navigator.clipboard.readText()).resolves.toBe(
      `${window.location.origin}/hooks/birfatura`
    )
    expect(
      screen.getByText(/Ayarlar > Mağaza Ayarları > Özel Entegrasyon > Yeni Mağaza Ekle/)
    ).toBeInTheDocument()
    expect(screen.getByText(/Doldur, Test Et ve Kaydet/)).toBeInTheDocument()
  })

  it("warns, without blocking, while BirFatura has never pulled; says when it last did", async () => {
    serve(MADE)
    const { unmount } = renderCard()
    expect(await screen.findByText(/BirFatura henüz sipariş çekmedi/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Yenile" })).toBeEnabled()
    unmount()

    serve(PULLED)
    renderCard()
    expect(await screen.findByText(/Son çekme: .* · 3 sipariş/)).toBeInTheDocument()
    expect(screen.queryByText(/henüz sipariş çekmedi/)).toBeNull()
  })

  it("offers the password to the owner alone", async () => {
    serve(MADE, "admin")
    renderCard()

    expect(await screen.findByText("Oluşturuldu")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/yalnızca mağaza sahibi/)).toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: "Bağlantı şifresi oluştur" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Yenile" })).toBeNull()
  })

  it("makes the password after the owner proves themselves, shows it once and copies it", async () => {
    const user = userEvent.setup()
    setReauthAsker((ask) => {
      ask.answer({ method: "password", secret: "sahibin-sifresi" })
    })
    let tries = 0
    serve(NONE, "owner", () =>
      ++tries === 1
        ? Promise.reject(refused(428))
        : Promise.resolve({ token: PASSWORD, birfatura: MADE })
    )
    renderCard()

    await user.click(await screen.findByRole("button", { name: "Bağlantı şifresi oluştur" }))
    const dialog = await screen.findByRole("dialog", { name: "Bağlantı şifresi" })
    expect(within(dialog).getByText(PASSWORD)).toBeInTheDocument()
    expect(within(dialog).getByText(/bir daha gösterilmeyecek/)).toBeInTheDocument()
    expect(within(dialog).getByText(/API Şifresi/)).toBeInTheDocument()
    expect(makes()).toEqual([
      [MAKE, { method: "POST", body: {} }],
      [
        MAKE,
        {
          method: "POST",
          body: {},
          headers: { "x-reauth-method": "password", "x-reauth-secret": "sahibin-sifresi" },
        },
      ],
    ])

    await user.click(within(dialog).getByRole("button", { name: "Şifreyi kopyala" }))
    await expect(navigator.clipboard.readText()).resolves.toBe(PASSWORD)
    expect(toast.success).toHaveBeenCalledWith("Şifre kopyalandı.")

    // Closed, it is gone: the card shows that one was made, never the password
    await user.click(within(dialog).getByRole("button", { name: "Kopyaladım, kapat" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    expect(screen.queryByText(PASSWORD)).toBeNull()
    expect(await screen.findByText("Oluşturuldu")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Yenile" })).toBeInTheDocument()
  })

  it("asks before renewing, as the old password stops at once; nothing is made on cancel", async () => {
    const user = userEvent.setup()
    serve(MADE)
    renderCard()

    await user.click(await screen.findByRole("button", { name: "Yenile" }))
    const ask = await screen.findByRole("dialog", { name: "Bağlantı şifresi yenilensin mi?" })
    expect(ask).toHaveTextContent("Eski şifre hemen çalışmaz")
    await user.click(within(ask).getByRole("button", { name: "Vazgeç" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    expect(makes()).toEqual([])

    await user.click(screen.getByRole("button", { name: "Yenile" }))
    const again = await screen.findByRole("dialog", { name: "Bağlantı şifresi yenilensin mi?" })
    await user.click(within(again).getByRole("button", { name: "Yeni şifre oluştur" }))

    expect(await screen.findByText(PASSWORD)).toBeInTheDocument()
    expect(makes()).toHaveLength(1)
  })

  it("says a password the server can no longer read must be renewed", async () => {
    serve({ token: { state: "unreadable", made_at: "2026-11-18T09:30:00.000Z" }, last_pull: null })
    renderCard()

    expect(await screen.findByText(/artık okunamıyor/)).toBeInTheDocument()
  })
})
