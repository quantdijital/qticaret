import { renderHook, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { CreatedAccount } from "@/features/wholesale/api/types"
import { useOutcome } from "@/features/wholesale/outcome"
import { account, clientWith, renderWith, tier } from "@/features/wholesale/wholesale.fixtures"
import { NewWholesalerDialog } from "./new-wholesaler-dialog"

const sdkFetch = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))

// A password made for the test, not anyone's
const PASSWORD = "Toptan-Yilmaz-2026"

const created: CreatedAccount = {
  account: account({ id: "wsa_new" }),
  password: "set",
  billing_profile: "none",
}

const answer = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  )

/** The create request (a plain fetch) answered in turn; the levels through the SDK. */
function serve(...answers: (() => Promise<Response>)[]) {
  sdkFetch.mockResolvedValue({ tiers: [tier()], count: 1 })
  const create = vi.fn()
  for (const each of answers) {
    create.mockImplementationOnce(each)
  }
  vi.stubGlobal("fetch", create)
  return create
}

const bodies = (create: ReturnType<typeof vi.fn>) =>
  (create.mock.calls as [string, { body: string }][]).map(
    ([, init]) => JSON.parse(init.body) as Record<string, unknown>
  )

function renderDialog() {
  renderWith(clientWith(), <NewWholesalerDialog open onOpenChange={() => undefined} />)
}

async function fillRequired() {
  await userEvent.type(screen.getByLabelText(/^E-posta/), "Siparis@YilmazTicaret.com")
  await userEvent.type(screen.getByLabelText(/^Yetkili adı soyadı/), "Ayşe Yılmaz")
  await userEvent.type(screen.getByRole("textbox", { name: /^Şifre/ }), PASSWORD)
  await userEvent.click(screen.getByRole("switch", { name: /Bu toptancıya özel fiyat/ }))
}

describe("NewWholesalerDialog", () => {
  beforeEach(() => {
    sdkFetch.mockReset()
    navigate.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("says what is missing, a short password too, and sends nothing", async () => {
    const create = serve()
    renderDialog()
    await userEvent.type(screen.getByLabelText(/^E-posta/), "ali@")
    await userEvent.type(screen.getByRole("textbox", { name: /^Şifre/ }), "kisa")
    await userEvent.click(screen.getByRole("button", { name: "Toptancıyı aç" }))
    expect(await screen.findByText("Geçerli bir e-posta adresi girin.")).toBeInTheDocument()
    expect(screen.getByText("Yetkilinin adını en az 2 harfle girin.")).toBeInTheDocument()
    expect(screen.getByText("Şifre en az 10 karakter olmalı.")).toBeInTheDocument()
    expect(
      screen.getByText("Bir toptan seviyesi seçin ya da bu toptancıya özel fiyatı açın.")
    ).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it("makes a strong password to hand over", async () => {
    serve()
    renderDialog()
    await userEvent.click(screen.getByRole("button", { name: "Güçlü şifre üret" }))
    const field = screen.getByRole<HTMLInputElement>("textbox", { name: /^Şifre/ })
    expect(field.value).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/)
  })

  it("opens the wholesaler with the password and goes to its page, the outcome kept", async () => {
    const create = serve(() => answer(201, created))
    renderDialog()
    await fillRequired()
    await userEvent.type(screen.getByLabelText(/^Bütün ürünlerde indirim oranı/), "12,5")
    await userEvent.click(screen.getByRole("button", { name: "Toptancıyı aç" }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: "/customers/wholesale/$id",
        params: { id: "wsa_new" },
      })
    })
    expect(create.mock.calls[0]?.[0]).toBe("/admin/wholesale/accounts")
    expect(bodies(create)).toEqual([
      {
        email: "siparis@yilmazticaret.com",
        contact_name: "Ayşe Yılmaz",
        company_name: null,
        tier_id: null,
        own_prices: true,
        percent: 12.5,
        min_quantity: null,
        password: PASSWORD,
      },
    ])
    const { result } = renderHook(() => useOutcome("wsa_new"))
    expect(result.current[0]).toEqual({ password: "set", billing: "none", taxTyped: false })
  })

  it("asks before taking over an unconfirmed sign-up, then sends again with take_over", async () => {
    const create = serve(
      () => answer(409, { code: "wholesale.unproven_signup", message: "Doğrulanmamış hesap var." }),
      () => answer(201, { ...created, password: "replaced" })
    )
    renderDialog()
    await fillRequired()
    await userEvent.click(screen.getByRole("button", { name: "Toptancıyı aç" }))
    const ask = await screen.findByRole("alertdialog")
    expect(within(ask).getByText("Doğrulanmamış hesap devralınsın mı?")).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    await userEvent.click(within(ask).getByRole("button", { name: "Hesabı devral" }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalled()
    })
    expect(bodies(create).map((body) => body["take_over"])).toEqual([undefined, true])
  })

  it("shows any other refusal in the window", async () => {
    serve(() =>
      answer(409, {
        code: "wholesale.exists",
        message: "Bu e-posta adresi için zaten bir toptancı kaydı var.",
      })
    )
    renderDialog()
    await fillRequired()
    await userEvent.click(screen.getByRole("button", { name: "Toptancıyı aç" }))
    expect(
      await screen.findByText("Bu e-posta adresi için zaten bir toptancı kaydı var.")
    ).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })
})
