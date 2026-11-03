import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BulkMessage, BulkReport } from "@/features/bulk-messages/api/types"
import {
  campaign,
  clientWith,
  counts,
  report,
} from "@/features/bulk-messages/bulk-messages.fixtures"
import { BulkReportView } from "./report-view"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => vi.fn(),
}))

function renderView(stored: BulkMessage, given: BulkReport) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    if (url === "/admin/bulk-messages/bm_1/report") {
      return Promise.resolve({ report: given })
    }
    if (init?.method === "POST") {
      return Promise.resolve({ campaign: { ...stored, status: "sending", paused_reason: null } })
    }
    return Promise.resolve({ segments: [], customer_groups: [] })
  })
  return render(
    <QueryClientProvider client={clientWith()}>
      <BulkReportView campaign={stored} />
    </QueryClientProvider>
  )
}

const tile = (label: string) => screen.getByText(label).closest("div") as HTMLElement

describe("BulkReportView (adr/0050 §9)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("counts what went, what was skipped and why, and what it brought", async () => {
    renderView(campaign({ status: "sent", editable: false }), report())

    expect(await screen.findByText("Gönderilen")).toBeInTheDocument()
    expect(within(tile("Hedef")).getByText("1.240")).toBeInTheDocument()
    expect(within(tile("Gönderilen")).getByText("1.200")).toBeInTheDocument()
    expect(within(tile("Başarısız")).getByText("4")).toBeInTheDocument()
    expect(within(tile("Atlanan")).getByText("248")).toBeInTheDocument()
    expect(within(tile("Geri dönen")).getByText("6")).toBeInTheDocument()
    expect(within(tile("Şikâyet")).getByText("1")).toBeInTheDocument()
    expect(within(tile("7 günde çıkış")).getByText("9")).toBeInTheDocument()

    const skipped = within(screen.getByLabelText("Atlananlar ve nedenleri"))
    expect(skipped.getByText("Bu kanalda izni yok")).toBeInTheDocument()
    expect(skipped.getByText("Gönderim engeli listesinde")).toBeInTheDocument()
    expect(skipped.getByText("Günlük sınıra takıldı")).toBeInTheDocument()

    expect(within(tile("Sipariş")).getByText("12")).toBeInTheDocument()
    expect(within(tile("Ciro")).getByText(/18\.450,50/)).toBeInTheDocument()
    // Ended: nothing to pause, resume or cancel; a copy still
    expect(screen.queryByRole("button", { name: "Duraklat" })).toBeNull()
    expect(screen.queryByRole("button", { name: "İptal et" })).toBeNull()
    expect(screen.getByRole("button", { name: "Diğer işlemler" })).toBeInTheDocument()
  })

  it("leaves bounces and complaints out of a text's report", async () => {
    renderView(
      campaign({ channel: "sms", status: "sent", editable: false }),
      report({ channel: "sms" })
    )

    expect(await screen.findByText("Gönderilen")).toBeInTheDocument()
    expect(screen.queryByText("Geri dönen")).toBeNull()
    expect(screen.queryByText("Şikâyet")).toBeNull()
  })

  it("says why a paused one waits, and resumes it after asking", async () => {
    const user = userEvent.setup()
    const paused = campaign({ status: "paused", paused_reason: "quota", editable: false })
    renderView(
      paused,
      report({ status: "paused", paused_reason: "quota", finished_at: null, counts: counts() })
    )

    expect(
      await screen.findByText(
        "Günlük gönderim sınırı doldu. Sınır 03:00'te yenilenince kendiliğinden sürer."
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Duraklat" })).toBeNull()
    expect(screen.getByRole("button", { name: "İptal et" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Sürdür" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Sürdür" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/bulk-messages/bm_1/resume", {
        method: "POST",
        body: {},
      })
    })
  })

  it("pauses a sending one at once and cancels only after asking", async () => {
    const user = userEvent.setup()
    const sending = campaign({ status: "sending", editable: false })
    renderView(sending, report({ status: "sending", finished_at: null }))

    await user.click(await screen.findByRole("button", { name: "Duraklat" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/bulk-messages/bm_1/pause", {
        method: "POST",
        body: {},
      })
    })

    await user.click(screen.getByRole("button", { name: "İptal et" }))
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Henüz ulaşılmamış alıcılara gönderilmez"
    )
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/bulk-messages/bm_1/cancel", {
      method: "POST",
      body: {},
    })
  })

  it("waits for a scheduled one to start, and shows what it will send", async () => {
    const user = userEvent.setup()
    const scheduled = campaign({
      status: "scheduled",
      scheduled_at: "2026-11-10T07:00:00Z",
      editable: false,
    })
    renderView(
      scheduled,
      report({ status: "scheduled", started_at: null, finished_at: null, traffic: null })
    )

    expect(
      await screen.findByText(/gönderim başlayınca sayılar burada görünür/)
    ).toBeInTheDocument()
    expect(screen.getAllByText(/10 Kas 2026/).length).toBeGreaterThan(0)

    await user.click(screen.getByRole("tab", { name: "İçerik" }))
    expect(screen.getByText("{ad}, kış indirimi başladı")).toBeInTheDocument()
    expect(screen.getByText("kis-indirimi-a1b2c3")).toBeInTheDocument()
  })
})
