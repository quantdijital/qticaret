import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { MfaSetupPage } from "./mfa-setup-page"

const fetchMock = vi.hoisted(() => vi.fn())
const mfa = vi.hoisted(() => ({ list: vi.fn(), start: vi.fn(), disable: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, auth: { mfa } } }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))
vi.mock("@/features/auth/api/me", () => ({
  useCurrentUser: () => ({ email: "sahip@example.com" }),
  useLogout: () => ({ mutate: vi.fn() }),
}))

// Throwaway values for this test only
const PASSWORD = "Gizli şifre 9"
const CODE = "482913"

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MfaSetupPage />
    </QueryClientProvider>
  )
}

describe("MfaSetupPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    mfa.list.mockResolvedValue({ mfa_factors: [] })
    mfa.start.mockResolvedValue({
      mfa_factor: { id: "mfa_1" },
      secret: "JBSWY3DPEHPK3PXP",
      otpauth_url: "otpauth://totp/panel?secret=JBSWY3DPEHPK3PXP",
    })
  })

  it("confirms the app with its code and the password, then proves the first recovery codes with that code", async () => {
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(path.endsWith("recovery-codes") ? { recovery_codes: ["AAAA-1111"] } : {})
    )
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText("Uygulamadaki 6 haneli kod"), CODE)
    expect(screen.getByRole("button", { name: "Doğrula" })).toBeDisabled()
    await user.type(screen.getByLabelText("Şifreniz"), PASSWORD)
    await user.click(screen.getByRole("button", { name: "Doğrula" }))

    expect(await screen.findByText("AAAA-1111")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/auth/mfa/factors/mfa_1/verify", {
      method: "POST",
      body: { code: CODE },
      headers: {
        "x-reauth-method": "password",
        "x-reauth-secret": encodeURIComponent(PASSWORD),
      },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/auth/mfa/recovery-codes", {
      method: "POST",
      body: {},
      headers: { "x-reauth-method": "totp", "x-reauth-secret": CODE },
    })
  })

  it("says so when the password is wrong", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("reauth"), { status: 428 }))
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText("Uygulamadaki 6 haneli kod"), CODE)
    await user.type(screen.getByLabelText("Şifreniz"), "yanlis")
    await user.click(screen.getByRole("button", { name: "Doğrula" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Şifre doğru değil; yeniden deneyin."
    )
  })
})
