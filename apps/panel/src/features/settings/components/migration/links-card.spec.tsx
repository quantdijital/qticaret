import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { LinksCard } from "./links-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const job = (changes: Record<string, unknown>) => ({
  id: "job_links",
  type: "content.link_rewrite",
  status: "succeeded",
  progress: 100,
  result_summary: { dry_run: false, documents: 40, rewritten: 12, changed: 31, unresolved: 4 },
  error_code: null,
  error_message: null,
  created_at: "2026-11-05T10:00:00.000Z",
  finished_at: "2026-11-05T10:01:00.000Z",
  expires_at: null,
  has_result: true,
  ...changes,
})

function renderCard(last: unknown) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) =>
    Promise.resolve(
      init?.method === "POST"
        ? { async_job: job({ status: "queued", result_summary: null, has_result: false }) }
        : url === "/admin/async-jobs"
          ? { async_jobs: last ? [last] : [] }
          : {}
    )
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <LinksCard />
    </QueryClientProvider>
  )
}

const posted = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method)

describe("LinksCard (adr/0042 Ek 2026-11-05)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("asks for the last run of its own kind and says when there is none", async () => {
    renderCard(null)
    expect(await screen.findByText(/Henüz çalıştırılmadı/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/async-jobs", {
      query: { type: "content.link_rewrite", limit: 1 },
    })
  })

  it("checks without writing, and fixes only once asked", async () => {
    renderCard(null)
    await screen.findByText(/Henüz çalıştırılmadı/)

    await userEvent.click(screen.getByRole("button", { name: "Kontrol et" }))
    await waitFor(() => {
      expect(posted()).toEqual([
        [
          "/admin/async-jobs",
          { method: "POST", body: { type: "content.link_rewrite", input: { dry_run: true } } },
        ],
      ])
    })

    fetchMock.mockClear()
    await userEvent.click(await screen.findByRole("button", { name: "Bağlantıları düzelt" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(posted()).toEqual([])
    await userEvent.click(within(dialog).getByRole("button", { name: "Bağlantıları düzelt" }))
    await waitFor(() => {
      expect(posted()).toEqual([
        [
          "/admin/async-jobs",
          { method: "POST", body: { type: "content.link_rewrite", input: { dry_run: false } } },
        ],
      ])
    })
  })

  it("tells what the last run did, with its report", async () => {
    renderCard(job({}))
    expect(
      await screen.findByText(/31 bağlantı düzeltildi, 4 bağlantının karşılığı yok/)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Raporu indir" })).toBeEnabled()
  })

  it("keeps both buttons off while a run is going", async () => {
    renderCard(job({ status: "running", result_summary: null, has_result: false }))
    expect(await screen.findByRole("status")).toHaveTextContent("Bağlantılar okunuyor")
    expect(screen.getByRole("button", { name: "Kontrol et" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Bağlantıları düzelt" })).toBeDisabled()
  })
})
