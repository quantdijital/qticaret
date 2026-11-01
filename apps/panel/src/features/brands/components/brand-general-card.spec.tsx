import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { Brand, BrandInput } from "@/features/brands/api/brands"
import { BrandGeneralCard } from "./brand-general-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const BRAND: Brand = {
  id: "brand_1",
  name: "Ada",
  handle: "ada",
  description: null,
  logo_file_id: null,
  logo_url: null,
  is_active: true,
  product_count: 0,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
}

describe("BrandGeneralCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    // The server trims the name it stores; the shop's URL style for the prefix
    fetchMock.mockImplementation((url: string, init?: { body?: BrandInput }) =>
      Promise.resolve(
        url === "/admin/brands/brand_1"
          ? { brand: { ...BRAND, ...init?.body, name: init?.body?.name?.trim() ?? BRAND.name } }
          : { values: { url_style: { brand: "nested" } } }
      )
    )
  })

  // The form keeps dirty values on a refetch; a save must still show what was stored
  it("shows the name as the server stored it after a save", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BrandGeneralCard brand={BRAND} />
      </QueryClientProvider>
    )
    const name = screen.getByRole("textbox", { name: /Marka adı/ })

    await userEvent.clear(name)
    await userEvent.type(name, "  Ada Bıçak  ")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(name).toHaveValue("Ada Bıçak")
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/brands/brand_1",
      expect.objectContaining({ method: "POST" })
    )
  })
})
