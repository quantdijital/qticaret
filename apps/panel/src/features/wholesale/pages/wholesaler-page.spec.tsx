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
    const record = pendingAccount()
    rememberOutcome({ account: record, message: "sent", billing_profile: "none" }, false)
    serve(record)
    renderWith(clientWith(), <WholesalerPage />)
    expect(await screen.findByRole("heading", { name: "Yılmaz Ticaret" })).toBeInTheDocument()
    expect(screen.getByText("Ayşe Yılmaz · siparis@yilmazticaret.com")).toBeInTheDocument()
    expect(screen.getByText("2 kez")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Toptan A" })).toHaveAttribute(
      "href",
      "/customers/wholesale/tiers/$id"
    )
    expect(screen.getByRole("status")).toHaveTextContent(/^Davet e-postası gönderildi\./)
    await userEvent.click(screen.getByRole("button", { name: "Kapat" }))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("sends a pending invitation again, and says so when it did not go", async () => {
    serve(pendingAccount(), () =>
      Promise.resolve({ account: pendingAccount(), message: "not_sent" })
    )
    renderWith(clientWith(), <WholesalerPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Daveti yeniden gönder" }))
    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        "Davet e-postası gönderilemedi. Biraz sonra yeniden deneyin."
      )
    })
    expect(writes()[0]).toEqual([
      "/admin/wholesale/accounts/wsa_2/invitation",
      { method: "POST", body: {} },
    ])
  })

  it.each([
    "Davet az önce gönderildi; bir saat sonra yeniden gönderebilirsiniz.",
    "Bu davet en çok 5 kez yeniden gönderilebilir.",
    "Bu davetin süresi doldu; toptancıyı silip yeniden açın.",
  ])("says why a resend was refused: %s", async (message) => {
    serve(pendingAccount(), () => refusal(message))
    renderWith(clientWith(), <WholesalerPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Daveti yeniden gönder" }))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(message)
    })
  })

  it("takes a pending invitation back after asking, and goes to the list", async () => {
    serve(pendingAccount(), () => Promise.resolve({ id: "wsa_2", deleted: true }))
    renderWith(clientWith(), <WholesalerPage />)
    await userEvent.click(await screen.findByRole("button", { name: "Daveti sil" }))
    await confirmWith("Daveti sil")
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/customers/wholesale" })
    })
    expect(writes()[0]).toEqual(["/admin/wholesale/accounts/wsa_2", { method: "DELETE" }])
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
