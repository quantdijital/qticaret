import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { formatMoney } from "@/lib/format"
import { StoreCreditCard } from "./store-credit-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StoreCreditCard customerId="cus_1" />
    </QueryClientProvider>
  )
}

// What the plugin answers: the account list, a new account, a credit
function answers(accounts: { id: string; balance: number }[]) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) =>
    Promise.resolve(
      init?.method !== "POST"
        ? { store_credit_accounts: accounts }
        : url === "/admin/store-credit-accounts"
          ? { store_credit_account: { id: "sc_acc_new" } }
          : { store_credit_account: { id: "sc_acc_new", balance: 50 } }
    )
  )
}

async function credit(amount: string, note = "") {
  await userEvent.type(screen.getByLabelText("Kredi ekle"), amount)
  if (note) {
    await userEvent.type(screen.getByLabelText("Not (isteğe bağlı)"), note)
  }
  await userEvent.click(screen.getByRole("button", { name: "Ekle" }))
}

describe("StoreCreditCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("opens the customer's account on their first credit", async () => {
    answers([])
    renderCard()
    expect(await screen.findByText(formatMoney(0, "try"))).toBeInTheDocument()
    await credit("50", "İade")
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/store-credit-accounts/sc_acc_new/credit", {
        method: "POST",
        body: { amount: 50, note: "İade" },
      })
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/store-credit-accounts", {
      method: "POST",
      body: { currency_code: "try", customer_id: "cus_1" },
    })
  })

  it("credits an account it has, with kuruş and without a note", async () => {
    answers([{ id: "sc_acc_1", balance: 120 }])
    renderCard()
    expect(await screen.findByText(formatMoney(120, "try"))).toBeInTheDocument()
    await credit("12,50")
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/store-credit-accounts/sc_acc_1/credit", {
        method: "POST",
        body: { amount: 12.5 },
      })
    })
    const made = fetchMock.mock.calls.filter(
      ([url, init]) =>
        url === "/admin/store-credit-accounts" && (init as { method?: string }).method === "POST"
    )
    expect(made).toEqual([])
  })

  it("adds nothing until the amount is above zero", async () => {
    answers([])
    renderCard()
    await screen.findByText(formatMoney(0, "try"))
    await userEvent.type(screen.getByLabelText("Kredi ekle"), "0")
    expect(screen.getByRole("button", { name: "Ekle" })).toBeDisabled()
  })
})
