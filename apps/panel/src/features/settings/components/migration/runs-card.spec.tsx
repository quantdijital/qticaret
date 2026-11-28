import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MigrationRun } from "@/features/settings/api/migration"
import { RecentRuns } from "./runs-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const run = (overrides: Partial<MigrationRun>): MigrationRun => ({
  id: "mrun_1",
  source: "wordpress",
  mode: "check",
  status: "failed",
  error_code: "interrupted",
  job_id: "ajob_1",
  counts: {},
  created_at: "2026-11-03T09:00:00.000Z",
  finished_at: null,
  ...overrides,
})

function renderRuns(onStarted = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RecentRuns onStarted={onStarted} />
    </QueryClientProvider>
  )
  return onStarted
}

describe("RecentRuns: a run stopped half-way", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it("says it stopped half-way and starts it again from its file", async () => {
    const runs = [run({}), run({ id: "mrun_2", status: "done", error_code: null })]
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === "/admin/migrations"
          ? { runs }
          : { async_job: { id: "ajob_2", status: "queued", error_message: null } }
      )
    )
    const onStarted = renderRuns()

    expect(await screen.findByText("Yarıda kaldı")).toBeInTheDocument()
    expect(screen.getByText("Bitti")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Kaldığı yerden sürdür" })).toHaveLength(1)
    await userEvent.click(screen.getByRole("button", { name: "Kaldığı yerden sürdür" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/migrations/mrun_1/restart", {
        method: "POST",
        body: {},
      })
    })
    await waitFor(() => {
      expect(onStarted).toHaveBeenCalledWith(expect.objectContaining({ id: "ajob_2" }))
    })
  })

  it("offers no second start once started again, and tells when the file is gone", async () => {
    const runs = [run({ error_code: "restarted" }), run({ id: "mrun_3" })]
    fetchMock.mockImplementation((url: string) =>
      url === "/admin/migrations"
        ? Promise.resolve({ runs })
        : Promise.reject(
            Object.assign(new Error("gone"), {
              status: 400,
              message: "Bu aktarımın dosyası artık saklanmıyor; dosyayı yeniden yükleyip başlatın.",
            })
          )
    )
    renderRuns()

    expect(await screen.findByText(/sürdürüldü/)).toBeInTheDocument()
    expect(screen.getAllByText("Yarıda kaldı")).toHaveLength(2)
    await userEvent.click(screen.getByRole("button", { name: "Kaldığı yerden sürdür" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Bu aktarımın dosyası artık saklanmıyor; dosyayı yeniden yükleyip başlatın."
      )
    })
  })
})
