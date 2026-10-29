import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { ReportExportButton } from "./report-export"

const fetchMock = vi.hoisted(() => vi.fn())
const assign = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/reports/use-report", () => ({
  useReportRange: () => ({ from: "2026-10-01", to: "2026-10-07" }),
}))

describe("ReportExportButton", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/admin/async-jobs"
          ? { async_job: { id: "job_1", status: "queued" } }
          : path.endsWith("/result")
            ? { url: "/static/satis-raporu.csv" }
            : { async_job: { id: "job_1", status: "succeeded", error_message: null } }
      )
    )
    vi.stubGlobal("location", { assign, origin: "http://localhost" })
  })

  it("makes the shown range's table on the server and downloads it", async () => {
    render(<ReportExportButton format="csv" table="products" />)

    await userEvent.click(screen.getByRole("button", { name: "CSV indir" }))

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith("http://localhost/static/satis-raporu.csv")
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/async-jobs", {
      method: "POST",
      body: {
        type: "report.export",
        input: {
          from: "2026-10-01",
          to: "2026-10-07",
          report: "sales",
          format: "csv",
          table: "products",
        },
      },
    })
  })
})
