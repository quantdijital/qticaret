import { renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { CreatedAccount } from "@/features/wholesale/api/types"
import { useOutcome } from "@/features/wholesale/outcome"
import {
  clientWith,
  pendingAccount,
  renderWith,
  tier,
} from "@/features/wholesale/wholesale.fixtures"
import { NewWholesalerDialog } from "./new-wholesaler-dialog"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))

const created: CreatedAccount = {
  account: pendingAccount({ id: "wsa_new" }),
  message: "not_sent",
  billing_profile: "none",
}

function serve(post: () => Promise<unknown> = () => Promise.resolve(created)) {
  fetchMock.mockImplementation((path: string, init?: { method?: string }) =>
    init?.method === "POST"
      ? post()
      : Promise.resolve(
          path.startsWith("/admin/wholesale/tiers") ? { tiers: [tier()], count: 1 } : {}
        )
  )
}

const posted = () =>
  (fetchMock.mock.calls as [string, { method?: string; body?: unknown } | undefined][]).find(
    ([, init]) => init?.method === "POST"
  )

function renderDialog() {
  renderWith(clientWith(), <NewWholesalerDialog open onOpenChange={() => undefined} />)
}

async function fillRequired() {
  await userEvent.type(screen.getByLabelText(/^E-posta/), "Siparis@YilmazTicaret.com")
  await userEvent.type(screen.getByLabelText(/^Yetkili adı soyadı/), "Ayşe Yılmaz")
}

describe("NewWholesalerDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
  })

  it("says what is missing and sends nothing", async () => {
    serve()
    renderDialog()
    await userEvent.type(screen.getByLabelText(/^E-posta/), "ali@")
    await userEvent.click(screen.getByRole("button", { name: "Toptancıyı aç" }))
    expect(await screen.findByText("Geçerli bir e-posta adresi girin.")).toBeInTheDocument()
    expect(screen.getByText("Yetkilinin adını en az 2 harfle girin.")).toBeInTheDocument()
    expect(
      screen.getByText("Bir toptan seviyesi seçin ya da bu toptancıya özel fiyatı açın.")
    ).toBeInTheDocument()
    expect(posted()).toBeUndefined()
  })

  it("asks for the tax office with the tax number", async () => {
    serve()
    renderDialog()
    await fillRequired()
    await userEvent.type(screen.getByLabelText(/^Vergi numarası/), "1234567890")
    await userEvent.click(screen.getByRole("switch", { name: /Bu toptancıya özel fiyat/ }))
    await userEvent.click(screen.getByRole("button", { name: "Toptancıyı aç" }))
    expect(
      await screen.findByText("Vergi dairesi ve vergi numarasını birlikte girin.")
    ).toBeInTheDocument()
    expect(screen.getByText("Vergi bilgisi için firma adı gerekir.")).toBeInTheDocument()
    expect(posted()).toBeUndefined()
  })

  it("opens a wholesaler with prices of its own and goes to its page, the outcome kept for it", async () => {
    serve()
    renderDialog()
    await fillRequired()
    await userEvent.click(screen.getByRole("switch", { name: /Bu toptancıya özel fiyat/ }))
    await userEvent.type(screen.getByLabelText(/^Bütün ürünlerde indirim oranı/), "12,5")
    await userEvent.click(screen.getByRole("button", { name: "Toptancıyı aç" }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: "/customers/wholesale/$id",
        params: { id: "wsa_new" },
      })
    })
    expect(posted()).toEqual([
      "/admin/wholesale/accounts",
      {
        method: "POST",
        body: {
          email: "siparis@yilmazticaret.com",
          contact_name: "Ayşe Yılmaz",
          company_name: null,
          tier_id: null,
          own_prices: true,
          percent: 12.5,
          min_quantity: null,
        },
      },
    ])
    const { result } = renderHook(() => useOutcome("wsa_new"))
    expect(result.current[0]).toEqual({
      status: "pending",
      message: "not_sent",
      billing: "none",
      taxTyped: false,
    })
  })

  it("shows the server's refusal in the window", async () => {
    serve(() =>
      Promise.reject(
        Object.assign(new Error("x"), {
          status: 409,
          message: "Bu e-posta adresi için zaten bir toptancı kaydı var.",
        })
      )
    )
    renderDialog()
    await fillRequired()
    await userEvent.click(screen.getByRole("switch", { name: /Bu toptancıya özel fiyat/ }))
    await userEvent.click(screen.getByRole("button", { name: "Toptancıyı aç" }))
    expect(
      await screen.findByText("Bu e-posta adresi için zaten bir toptancı kaydı var.")
    ).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })
})
