import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { GlobalSearch } from "@/features/search/api"
import { CommandMenu } from "./command-menu"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))
vi.mock("@/features/auth/api/me", () => ({ useLogout: () => ({ mutate: vi.fn() }) }))

const FOUND: GlobalSearch = {
  orders: [
    {
      id: "order_217",
      display_id: 217,
      name: "Can Deneme",
      total: "280.30",
      currency_code: "try",
    },
  ],
  customers: [{ id: "cus_1", name: "Can Deneme", email: "can@example.com" }],
  products: [{ id: "prod_1", title: "El Dokuma Havlu", sku: "HAVLU-217" }],
  parcels: [
    { order_id: "order_217", display_id: 217, tracking_number: "AR217TR", provider: "aras" },
  ],
}

function renderMenu(onOpenChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <CommandMenu open onOpenChange={onOpenChange} />
    </QueryClientProvider>
  )
  return onOpenChange
}

describe("CommandMenu search", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(FOUND)
    vi.clearAllMocks()
  })

  it("finds orders, parcels, customers and products, and opens the one picked", async () => {
    const user = userEvent.setup()
    const onOpenChange = renderMenu()

    await user.type(screen.getByRole("combobox"), "217")

    expect(await screen.findByText("#217")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith("/admin/global-search", { query: { q: "217" } })
    expect(screen.getByText("AR217TR")).toBeInTheDocument()
    expect(screen.getByText("can@example.com")).toBeInTheDocument()
    expect(screen.getByText("HAVLU-217")).toBeInTheDocument()

    await user.click(screen.getByText("El Dokuma Havlu"))

    expect(navigate).toHaveBeenCalledWith({ to: "/products/$id", params: { id: "prod_1" } })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("asks nothing for a single letter, and still offers the pages", async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.type(screen.getByRole("combobox"), "s")

    expect(screen.getByText("Siparişler")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
