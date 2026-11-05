import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AuditReport, AuditRun } from "@/features/seo/api/audit"
import { AuditCard } from "./audit-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const run = (more: Partial<AuditRun> = {}): AuditRun => ({
  id: "job_night",
  status: "succeeded",
  progress: 100,
  created_at: "2026-11-05T01:15:00Z",
  finished_at: "2026-11-05T01:16:00Z",
  ...more,
})

const report: AuditReport = {
  id: "job_night",
  created_at: "2026-11-05T01:15:00Z",
  finished_at: "2026-11-05T01:16:00Z",
  findings: [],
  has_file: true,
}

function renderCard(audit: { latest: AuditRun | null; report: AuditReport | null }) {
  fetchMock.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/admin/seo/audit/report" ? { url: "/static/seo-audit-1.csv" } : { audit }
    )
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AuditCard />
    </QueryClientProvider>
  )
}

describe("AuditCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("reads the night's audit from its own route and downloads its report there", async () => {
    renderCard({ latest: run(), report })

    expect(await screen.findByText("Mağaza genelinde sorun bulunmadı.")).toBeInTheDocument()
    // Not through the jobs list: the night's runs are not the shop's jobs (docs/06 principle 10)
    expect(fetchMock).toHaveBeenCalledWith("/admin/seo/audit")
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/async-jobs", expect.anything())
    await userEvent.click(screen.getByRole("button", { name: "Raporu indir" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/seo/audit/report")
    })
  })

  it("offers no download once the report file is gone, and says a failed run in the card", async () => {
    renderCard({
      latest: run({ id: "job_retry", status: "failed" }),
      report: { ...report, has_file: false },
    })

    expect(await screen.findByText("Son denetim tamamlanamadı; yeniden başlatın.")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Raporu indir" })).toBeNull()
    expect(screen.getByRole("button", { name: "Şimdi denetle" })).toBeEnabled()
  })

  it("says the first audit is still to come", async () => {
    renderCard({ latest: null, report: null })

    expect(await screen.findByText(/Henüz denetim yok/)).toBeInTheDocument()
  })
})
