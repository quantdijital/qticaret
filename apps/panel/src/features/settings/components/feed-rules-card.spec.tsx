import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { FeedRulesCard } from "./feed-rules-card"

const fetchMock = vi.hoisted(() => vi.fn())
const listCategories = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: { productCategory: { list: listCategories } },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const EXCLUSIONS = { google: [], meta: [], cimri: [], akakce: ["pcat_bahce"] }

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <FeedRulesCard />
    </QueryClientProvider>
  )
}

describe("FeedRulesCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      section: "marketing",
      values: {
        abandoned_cart_enabled: false,
        abandoned_cart_delay_minutes: 60,
        feed_exclusions: EXCLUSIONS,
        feed_same_day_cutoff_hour: null,
      },
    })
    listCategories.mockResolvedValue({
      product_categories: [
        { id: "pcat_mutfak", name: "Mutfak", handle: "mutfak", parent_category_id: null, rank: 0 },
        { id: "pcat_bahce", name: "Bahçe", handle: "bahce", parent_category_id: null, rank: 1 },
      ],
    })
  })

  it("keeps a category out of one feed and leaves the others as they were", async () => {
    renderCard()
    await userEvent.click(await screen.findByRole("radio", { name: "Cimri" }))
    await userEvent.click(await screen.findByRole("checkbox", { name: "Mutfak" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/platform-settings/marketing",
        expect.objectContaining({
          method: "POST",
          body: { feed_exclusions: { ...EXCLUSIONS, cimri: ["pcat_mutfak"] } },
        })
      )
    })
  })

  it("saves the same-day hour the product pages and Akakçe show", async () => {
    const user = userEvent.setup()
    renderCard()
    expect(
      await screen.findByText(/ürün sayfalarınızın Kargo ve Teslimat kartında ve Akakçe'de/)
    ).toBeInTheDocument()
    await user.click(screen.getByRole("combobox", { name: "Aynı gün kargo saati" }))
    await user.click(await screen.findByRole("option", { name: "15:00 öncesi siparişler" }))
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/platform-settings/marketing",
        expect.objectContaining({ method: "POST", body: { feed_same_day_cutoff_hour: 15 } })
      )
    })
  })

  it("takes the same-day hour back off", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue({
      section: "marketing",
      values: {
        abandoned_cart_enabled: false,
        abandoned_cart_delay_minutes: 60,
        feed_exclusions: EXCLUSIONS,
        feed_same_day_cutoff_hour: 15,
      },
    })
    renderCard()
    await user.click(await screen.findByRole("combobox", { name: "Aynı gün kargo saati" }))
    await user.click(await screen.findByRole("option", { name: "Aynı gün kargo yok" }))
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/platform-settings/marketing",
        expect.objectContaining({ method: "POST", body: { feed_same_day_cutoff_hour: null } })
      )
    })
  })

  it("counts what each feed leaves out", async () => {
    renderCard()

    expect(await screen.findByRole("radio", { name: "Akakçe (1)" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Google" })).toHaveAttribute("aria-checked", "true")
  })
})
