import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PrivacyRequest } from "@/features/customers/api/privacy"
import { PrivacyRequestsCard } from "./privacy-requests-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const request = (over: Partial<PrivacyRequest>): PrivacyRequest => ({
  id: "preq_1",
  kind: "export",
  channel: "email",
  status: "open",
  received_at: "2026-10-28T09:00:00.000Z",
  due_at: "2099-11-27T09:00:00.000Z",
  job_id: null,
  completed_at: null,
  ...over,
})

function serve(requests: PrivacyRequest[]) {
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/staff/me"
        ? { role: "owner", can: { privacy: true } }
        : url.endsWith("/privacy-requests")
          ? { privacy_requests: requests }
          : {}
    )
  )
}

const renderCard = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PrivacyRequestsCard customerId="cus_1" />
    </QueryClientProvider>
  )

describe("PrivacyRequestsCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("records a request as it came, with the day it came", async () => {
    serve([])
    renderCard()

    await userEvent.click(await screen.findByRole("button", { name: "Talep kaydet" }))
    const dialog = screen.getByRole("dialog")
    await userEvent.click(within(dialog).getByRole("radio", { name: "Verilerinin silinmesi" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Talep kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/customers/cus_1/privacy-requests", {
        method: "POST",
        body: expect.objectContaining({ kind: "erasure", channel: "email" }) as unknown,
      })
    })
  })

  it("prepares an export's file, and erases only once asked twice", async () => {
    serve([request({}), request({ id: "preq_2", kind: "erasure", channel: "letter" })])
    renderCard()

    expect(await screen.findAllByText(/Açık · son gün/)).toHaveLength(2)
    await userEvent.click(screen.getByRole("button", { name: "Dosyayı hazırla" }))
    expect(fetchMock).toHaveBeenCalledWith("/admin/privacy-requests/preq_1/export", {
      method: "POST",
      body: {},
    })

    await userEvent.click(screen.getByRole("button", { name: "Verileri sil" }))
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/privacy-requests/preq_2/erase",
      expect.anything()
    )
    await userEvent.click(await screen.findByRole("button", { name: "Kalıcı olarak sil" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/privacy-requests/preq_2/erase", {
        method: "POST",
        body: {},
      })
    })
  })
})
