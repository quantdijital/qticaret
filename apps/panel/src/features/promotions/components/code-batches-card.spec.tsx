import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { CodeBatchesCard } from "./code-batches-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const BATCH = {
  campaign_id: "procamp_1",
  ends_at: null,
  created_at: "2026-10-26T10:00:00.000Z",
  count: 250,
  used: 12,
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CodeBatchesCard promotionId="promo_1" code="YAZ" />
    </QueryClientProvider>
  )
}

describe("CodeBatchesCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("lists a promotion's batches with their use and a link to their codes", async () => {
    fetchMock.mockResolvedValue({ batches: [BATCH] })
    renderCard()
    expect(await screen.findByText("250 kod")).toBeInTheDocument()
    expect(screen.getByText(/12 kullanıldı/u)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "CSV indir" })).toHaveAttribute(
      "href",
      "/admin/promotions/promo_1/code-batches/procamp_1/codes"
    )
  })

  it("asks for a count from 1 to 10,000, then starts the job", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === "/admin/async-jobs"
          ? { async_job: { id: "job_1", status: "queued" } }
          : url.startsWith("/admin/async-jobs/")
            ? { async_job: { id: "job_1", status: "running", progress: 40 } }
            : { batches: [] }
      )
    )
    renderCard()
    await userEvent.click(await screen.findByRole("button", { name: "Kod üret" }))
    const count = screen.getByLabelText("Kaç kod?")
    await userEvent.clear(count)
    await userEvent.type(count, "20000")
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Kod üret" })
    )
    expect(screen.getByText("1 ile 10.000 arasında bir sayı girin.")).toBeInTheDocument()

    await userEvent.clear(count)
    await userEvent.type(count, "250")
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Kod üret" })
    )
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/async-jobs", {
        method: "POST",
        body: { type: "promotion.codes", input: { promotion_id: "promo_1", count: 250 } },
      })
    })
    expect(await screen.findByText("Kodlar üretiliyor… %40")).toBeInTheDocument()
  })

  it("stops a batch after asking, and shows a closed one as closed", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith("/revoke")
          ? { batch: { campaign_id: "procamp_1" } }
          : {
              batches: [
                BATCH,
                { ...BATCH, campaign_id: "procamp_2", ends_at: "2026-01-01T00:00:00.000Z" },
              ],
            }
      )
    )
    renderCard()
    expect(await screen.findByText("Kapalı")).toBeInTheDocument()
    // Only the open batch can be stopped
    await userEvent.click(screen.getByRole("button", { name: "Durdur" }))
    await userEvent.click(await screen.findByRole("button", { name: "Partiyi durdur" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/promotions/promo_1/code-batches/procamp_1/revoke",
        { method: "POST", body: {} }
      )
    })
  })
})
