import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AsyncJob } from "@/features/settings/api/activity"
import { JobCancelButton } from "./job-cancel-button"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const job = (status: AsyncJob["status"]): AsyncJob => ({
  id: "ajob_1",
  type: "catalog.import",
  status,
  progress: 40,
  result_summary: null,
  error_code: null,
  created_at: "2026-10-31T09:00:00.000Z",
  finished_at: null,
  expires_at: null,
  has_result: false,
})

const renderButton = (status: AsyncJob["status"]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JobCancelButton job={job(status)} />
    </QueryClientProvider>
  )

describe("JobCancelButton", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ async_job: job("cancelled") })
  })

  it("stops a running job once asked", async () => {
    renderButton("running")

    await userEvent.click(screen.getByRole("button", { name: "İptal et" }))
    expect(fetchMock).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole("button", { name: "İptal et" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/async-jobs/ajob_1/cancel", {
        method: "POST",
        body: {},
      })
    })
  })

  it("offers nothing for a finished job", () => {
    renderButton("succeeded")

    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
