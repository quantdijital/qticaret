import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { CustomerDetail } from "@/features/customers/api/customers"
import { CustomerDialog } from "./customer-dialog"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))

const consent = { address: true, consent: null }

/** What a POST to the path carried, if one went. */
const sent = (path: string): unknown =>
  (fetchMock.mock.calls as [string, { method?: string } | undefined][]).find(
    ([called, init]) => called === path && init?.method === "POST"
  )?.[1]

function serve() {
  fetchMock.mockImplementation((path: string, init?: { method?: string }) => {
    if (init?.method === "POST") {
      return Promise.resolve({ customer: { id: "cus_new" } })
    }
    if (path.endsWith("/note")) {
      return Promise.resolve({
        note: { body: "Kapıda ödeme ister.", updated_at: null, updated_by: null },
      })
    }
    return Promise.resolve({ consents: { email: consent, sms: consent } })
  })
}

const customer = (hasAccount: boolean) =>
  ({
    id: "cus_1",
    first_name: "Ayşe",
    last_name: "Yılmaz",
    email: "ayse@example.com",
    phone: "+905321234567",
    company_name: null,
    has_account: hasAccount,
    created_at: "2026-10-01T00:00:00Z",
    addresses: [],
  }) as unknown as CustomerDetail

function renderDialog(value: CustomerDetail | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <CustomerDialog customer={value} open onOpenChange={() => undefined} />
    </QueryClientProvider>
  )
}

describe("CustomerDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    serve()
  })

  it("shows a member's e-mail as their sign-in, not to be changed here", async () => {
    renderDialog(customer(true))

    const email = await screen.findByLabelText(/E-posta/)
    expect(email).toHaveAttribute("readonly")
    expect(screen.getByText(/yalnızca müşteri kendi hesabından/)).toBeInTheDocument()
    expect(await screen.findByDisplayValue("Kapıda ödeme ister.")).toBeInTheDocument()
  })

  it("lets a guest's e-mail be corrected, and saves only the details", async () => {
    const user = userEvent.setup()
    renderDialog(customer(false))

    const email = await screen.findByLabelText(/E-posta/)
    expect(email).not.toHaveAttribute("readonly")
    await user.clear(email)
    await user.type(email, "ayse.yeni@example.com")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(sent("/admin/customers/cus_1")).toMatchObject({
      method: "POST",
      body: { email: "ayse.yeni@example.com", phone: "+905321234567" },
    })
    expect(sent("/admin/customers/cus_1/note")).toBeUndefined()
  })

  it("adds a guest, its consent left to the person, and opens their page", async () => {
    const user = userEvent.setup()
    renderDialog(null)

    expect(screen.getByText(/İzni yalnızca müşteri kendisi verir/)).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/E-posta/), "yeni@example.com")
    await user.type(screen.getByLabelText(/Telefon/), "12345")
    await user.click(screen.getByRole("button", { name: "Müşteriyi ekle" }))
    expect(await screen.findByText(/Telefon numarası geçerli değil/)).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Telefon/))
    await user.click(screen.getByRole("button", { name: "Müşteriyi ekle" }))
    expect(sent("/admin/customers")).toMatchObject({
      method: "POST",
      body: { email: "yeni@example.com" },
    })
    expect(navigate).toHaveBeenCalledWith({ to: "/customers/$id", params: { id: "cus_new" } })
  })
})
