import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { OrderDetail } from "@/features/orders/api/orders"
import { CustomerCard } from "./people-cards"

const fetchMock = vi.hoisted(() => vi.fn())
const updateMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { order: { update: updateMock } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, search }: { children: ReactNode; search?: { customer?: string } }) => (
    <a href={search?.customer ? `/orders?customer=${search.customer}` : "/customers/x"}>
      {children}
    </a>
  ),
}))

const address = {
  first_name: "Ayşe",
  last_name: "Yılmaz",
  company: null,
  address_1: "Atatürk Cad. No: 5",
  address_2: "Moda Mah.",
  province: "İstanbul",
  city: "Kadıköy",
  postal_code: "34710",
  phone: "+905321234567",
}

const order = (more: Record<string, unknown> = {}) =>
  ({
    id: "order_1",
    display_id: 1042,
    status: "pending",
    email: "ayse@ornek.com.tr",
    customer: { id: "cus_1", first_name: "Ayşe", last_name: "Yılmaz", email: "ayse@ornek.com.tr" },
    shipping_address: address,
    billing_address: address,
    ...more,
  }) as unknown as OrderDetail

const renderCard = (detail: OrderDetail, billingLocked: boolean | null = false) => {
  fetchMock.mockImplementation((url: string) =>
    url === "/admin/order-board/order_1"
      ? billingLocked === null
        ? new Promise(() => undefined)
        : Promise.resolve({ stage: "to_ship", billing_locked: billingLocked })
      : Promise.resolve({})
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CustomerCard order={detail} editable />
    </QueryClientProvider>
  )
}

describe("CustomerCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    updateMock.mockReset()
    updateMock.mockResolvedValue({ order: {} })
  })

  it("links to the customer's other orders and says a billing address like the delivery one", async () => {
    renderCard(order())
    expect(screen.getByRole("link", { name: "Bu müşterinin diğer siparişleri" })).toHaveAttribute(
      "href",
      "/orders?customer=cus_1"
    )
    expect(screen.getByText("Teslimat adresiyle aynı.")).toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: "Fatura adresini düzenle" })
    ).toBeInTheDocument()
  })

  it("changes the e-mail in place", async () => {
    renderCard(order())
    await userEvent.click(screen.getByRole("button", { name: "E-postayı düzenle" }))
    const input = screen.getByLabelText(/E-posta/, { selector: "input" })
    await userEvent.clear(input)
    await userEvent.type(input, "yanlis")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText("Geçerli bir e-posta adresi yazın.")).toBeInTheDocument()
    expect(updateMock).not.toHaveBeenCalled()

    await userEvent.clear(input)
    await userEvent.type(input, "ayse.yilmaz@ornek.com.tr")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith("order_1", { email: "ayse.yilmaz@ornek.com.tr" })
    })
  })

  it("keeps the billing address once the invoice provider holds it", async () => {
    renderCard(order({ billing_address: { ...address, company: "Yılmaz Ltd." } }), true)
    expect(
      await screen.findByText(
        "Fatura kesildi ya da sağlayıcıya iletildi; fatura adresi artık değişmez."
      )
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/order-board/order_1")
    expect(screen.getByText("Yılmaz Ltd.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Fatura adresini düzenle" })).toBeNull()
    // The delivery address still changes until the order is packed
    expect(screen.getByRole("button", { name: "Teslimat adresini düzenle" })).toBeInTheDocument()
  })

  it("offers no billing change before the server says it is open", () => {
    renderCard(order(), null)
    expect(screen.queryByRole("button", { name: "Fatura adresini düzenle" })).toBeNull()
    expect(screen.getByRole("button", { name: "Teslimat adresini düzenle" })).toBeInTheDocument()
  })

  it("changes neither the e-mail nor the billing address of a canceled order", () => {
    renderCard(order({ status: "canceled" }))
    expect(screen.queryByRole("button", { name: "E-postayı düzenle" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Fatura adresini düzenle" })).toBeNull()
  })
})
