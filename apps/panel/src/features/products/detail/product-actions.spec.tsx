import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductDetail } from "@/features/products/api/products"
import { ProductActions } from "./product-actions"

const fetchMock = vi.hoisted(() => vi.fn())
const navigateMock = vi.hoisted(() => vi.fn())
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { product: { update: vi.fn(), delete: vi.fn() } } },
}))
vi.mock("sonner", () => ({ toast: toastMock }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigateMock }))

const product = (status: string) =>
  ({ id: "prod_1", title: "Şef Bıçağı", status }) as unknown as ProductDetail

function renderActions(status: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProductActions product={product(status)} />
    </QueryClientProvider>
  )
}

describe("a product's header actions", () => {
  const tab = { opener: {} as unknown, location: { href: "about:blank" }, close: vi.fn() }

  beforeEach(() => {
    fetchMock.mockReset()
    navigateMock.mockReset()
    toastMock.success.mockReset()
    tab.location.href = "about:blank"
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window)
  })

  it("opens a published product's own page on the storefront", async () => {
    fetchMock.mockResolvedValue({
      live: true,
      url: "https://magaza.example/urun/sef-bicagi",
      path: "/urun/sef-bicagi",
      expires_at: null,
    })
    renderActions("published")
    await userEvent.click(screen.getByRole("button", { name: "Vitrinde gör" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/preview", { method: "POST" })
    await waitFor(() => {
      expect(tab.location.href).toBe("https://magaza.example/urun/sef-bicagi")
    })
    expect(tab.opener).toBeNull()
    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it("opens a draft's signed preview, said to last a day", async () => {
    fetchMock.mockResolvedValue({
      live: false,
      url: "http://localhost:8000/onizleme/prod_1.abc.mac",
      path: "/onizleme/prod_1.abc.mac",
      expires_at: "2026-11-07T10:00:00.000Z",
    })
    renderActions("draft")
    expect(screen.queryByRole("button", { name: "Vitrinde gör" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Önizle" }))

    await waitFor(() => {
      expect(tab.location.href).toBe("http://localhost:8000/onizleme/prod_1.abc.mac")
    })
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining("24 saat"))
  })

  it("copies the product from its menu and opens the copy", async () => {
    fetchMock.mockResolvedValue({
      product: { id: "prod_2", handle: "sef-bicagi-kopya", title: "Şef Bıçağı (kopya)" },
    })
    renderActions("published")
    await userEvent.click(screen.getByRole("button", { name: "Diğer işlemler" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Kopyala" }))

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/products/$id", params: { id: "prod_2" } })
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/duplicate", { method: "POST" })
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining("Şef Bıçağı (kopya)"))
  })
})
