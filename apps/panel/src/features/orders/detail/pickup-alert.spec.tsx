import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { PickupAlert } from "./pickup-alert"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderAlert(parcels: string[]) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PickupAlert orderId="order_1" parcels={parcels} />
    </QueryClientProvider>
  )
}

describe("PickupAlert", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ url: "https://files.example.com/etiket.pdf" })
  })

  it("says the parcel waits for its pickup and opens its label", async () => {
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() }
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window)
    renderAlert(["ful_1"])

    expect(screen.getByText(/kargo firması teslim aldığında/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Etiketi indir" }))

    await waitFor(() => {
      expect(tab.location.href).toBe("https://files.example.com/etiket.pdf")
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/fulfillments/ful_1/label")
    expect(tab.opener).toBeNull()
  })

  it("numbers the labels of several parcels", () => {
    renderAlert(["ful_1", "ful_2"])

    expect(screen.getByRole("button", { name: "Etiket 1" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Etiket 2" })).toBeInTheDocument()
    expect(screen.getByText(/2 kolinin etiketi hazır/)).toBeInTheDocument()
  })
})
