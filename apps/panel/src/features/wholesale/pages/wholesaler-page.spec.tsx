import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { WholesaleAccount } from "@/features/wholesale/api/types"
import { rememberOutcome } from "@/features/wholesale/outcome"
import {
  account,
  clientWith,
  pendingAccount,
  renderWith,
} from "@/features/wholesale/wholesale.fixtures"
import { WholesalerPage } from "./wholesaler-page"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const params = vi.hoisted(() => ({ id: "wsa_1" }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  getRouteApi: () => ({ useParams: () => params }),
  useNavigate: () => navigate,
}))

type Init = { method?: string; body?: unknown } | undefined

/** The account read, and each write answered by `write` (or as the API would). */
function serve(record: WholesaleAccount, write?: (path: string, init: Init) => Promise<unknown>) {
  params.id = record.id
  fetchMock.mockImplementation((path: string, init: Init) => {
    if (init?.method === "POST" || init?.method === "DELETE") {
      return write
        ? write(path, init)
        : Promise.resolve({ account: record, carts: { repriced: 0, failed: 0 }, message: "sent" })
    }
    if (path.startsWith("/admin/wholesale/tiers")) {
      return Promise.resolve({ tiers: [], count: 0 })
    }
    return Promise.resolve({ account: record })
  })
}

const writes = () =>
  (fetchMock.mock.calls as [string, Init][]).filter(
    ([, init]) => init?.method === "POST" || init?.method === "DELETE"
  )

const refusal = (message: string, status = 409) =>
  Promise.reject(Object.assign(new Error(message), { status, message }))

async function confirmWith(name: string) {
  const dialog = await screen.findByRole("alertdialog")
  await userEvent.click(within(dialog).getByRole("button", { name }))
}

describe("WholesalerPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
    vi.mocked(toast.warning).mockReset()
  })

  it("shows who they are, the state and the level, and what opening them did", async () => {
    const record = account()
    rememberOutcome({ account: record, password: "set", billing_profile: "none" }, false)
    serve(record)
    renderWith(clientWith(), <WholesalerPage />)
    expect(await screen.findByRole("heading", { name: "Kaya Bıçak Ltd" })).toBeInTheDocument()
    expect(screen.getByText("Ali Kaya · satinalma@kayabicak.com.tr")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Toptan A" })).toHaveAttribute(
      "href",
      "/customers/wholesale/tiers/$id"
    )
    expect(screen.getByRole("status")).toHaveTextContent(/^Toptancı hesabı açıldı ve etkin\./)
    await userEvent.click(screen.getByRole("button", { name: "Kapat" }))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("offers no invitation: an older pending one has no resend and no delete", async () => {
    serve(pendingAccount())
    renderWith(clientWith(), <WholesalerPage />)
    expect(await screen.findByRole("heading", { name: "Yılmaz Ticaret" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Davet/ })).not.toBeInTheDocument()
    // No sign-in to set a password on yet
    expect(screen.queryByRole("button", { name: "Yeni şifre" })).not.toBeInTheDocument()
  })

  it("sets a new password, every open sign-in ended, and says why one is refused", async () => {
    // A password made for the test, not anyone's
    const password = "Toptan-Kaya-2026"
    serve(account(), (path) =>
      path.endsWith("/password")
        ? Promise.resolve({ account: account(), signed_out: true })
        : Promise.resolve({})
    )
    renderWith(clientWith(), <WholesalerPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Yeni şifre" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByRole("textbox", { name: /^Şifre/ }), password)
    await userEvent.click(within(dialog).getByRole("button", { name: "Şifreyi kaydet" }))
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Yeni şifre kaydedildi; toptancının açık oturumları kapandı."
      )
    })
    expect(writes()[0]).toEqual([
      "/admin/wholesale/accounts/wsa_1/password",
      { method: "POST", body: { password } },
    ])
  })

  it("offers no new password where the customer keeps their own, or on a closed account (M4)", async () => {
    serve(account({ staff_login: false }))
    const { unmount } = renderWith(clientWith(), <WholesalerPage />)
    expect(await screen.findByText(/Şifremi unuttum/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Yeni şifre" })).not.toBeInTheDocument()
    unmount()
    serve(account({ status: "inactive" }))
    renderWith(clientWith(), <WholesalerPage />)
    expect(await screen.findByRole("button", { name: "Yeniden aç" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Yeni şifre" })).not.toBeInTheDocument()
  })

  it("keeps the window open with the server's refusal of a new password", async () => {
    const why =
      "Bu müşteri e-posta ve şifreyle değil, başka bir yolla (ör. Google) giriş yapıyor; şifre belirlenemez."
    serve(account(), () => refusal(why))
    renderWith(clientWith(), <WholesalerPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Yeni şifre" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: /^Şifre/ }),
      "Toptan-Kaya-2026"
    )
    await userEvent.click(within(dialog).getByRole("button", { name: "Şifreyi kaydet" }))
    expect(await within(dialog).findByText(why)).toBeInTheDocument()
  })

  it("closes an active wholesaler after asking, the carts' result in words, a failure warned", async () => {
    serve(account(), () =>
      Promise.resolve({
        account: account({ status: "inactive" }),
        carts: { repriced: 2, failed: 1 },
      })
    )
    renderWith(clientWith(), <WholesalerPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Devre dışı bırak" }))
    await confirmWith("Devre dışı bırak")
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Toptancı devre dışı bırakıldı. 2 açık sepet yeniden fiyatlandı."
      )
    })
    expect(toast.warning).toHaveBeenCalledWith(
      "1 açık sepet yeniden fiyatlanamadı; müşteri sepetini açtığında fiyatlar güncellenir."
    )
    expect(writes()[0]?.[0]).toBe("/admin/wholesale/accounts/wsa_1/deactivate")
  })

  it("deletes a wholesaler after asking, says the customer stays, and goes to the list", async () => {
    serve(account(), () =>
      Promise.resolve({ id: "wsa_1", deleted: true, carts: { repriced: 1, failed: 0 } })
    )
    renderWith(clientWith(), <WholesalerPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Sil" }))
    const ask = await screen.findByRole("alertdialog")
    expect(within(ask).getByText(/Müşteri kaydı ve girişi kalır/)).toBeInTheDocument()
    await userEvent.click(within(ask).getByRole("button", { name: "Sil" }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/customers/wholesale" })
    })
    expect(toast.success).toHaveBeenCalledWith("Toptancı silindi. 1 açık sepet yeniden fiyatlandı.")
    expect(writes()[0]).toEqual(["/admin/wholesale/accounts/wsa_1", { method: "DELETE" }])
  })

  it("opens a closed wholesaler again", async () => {
    const closed = account({ status: "inactive", deactivated_at: "2026-11-12T09:00:00Z" })
    serve(closed)
    renderWith(clientWith(), <WholesalerPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Yeniden aç" }))
    await confirmWith("Yeniden aç")
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Toptancı yeniden açıldı.")
    })
    expect(writes()[0]?.[0]).toBe("/admin/wholesale/accounts/wsa_1/reactivate")
  })

  it("offers prices of their own when there are none", async () => {
    serve(account())
    renderWith(clientWith(), <WholesalerPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Özel fiyat aç" }))
    await waitFor(() => {
      expect(writes()[0]).toEqual([
        "/admin/wholesale/accounts/wsa_1",
        { method: "POST", body: { own_prices: true } },
      ])
    })
  })

  it("shows their own prices when they have them", async () => {
    const own = account({ own_prices: true, percent: 10 })
    params.id = own.id
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        path.endsWith("/lines")
          ? { lines: [], count: 0, undercut_count: 0, rate_zero: { count: 0, variant_ids: [] } }
          : { account: own }
      )
    )
    renderWith(clientWith(), <WholesalerPage />)
    expect(await screen.findByText("Toptan fiyatlar")).toBeInTheDocument()
    expect(screen.getByText("Açık · bütün ürünlerde %10 indirim")).toBeInTheDocument()
  })
})
