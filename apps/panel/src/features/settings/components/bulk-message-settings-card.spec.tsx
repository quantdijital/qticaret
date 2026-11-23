import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { BulkMessageSettingsCard } from "./bulk-message-settings-card"
import { SmsOptOutCard } from "./sms-opt-out-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const STORED = {
  campaign_frequency_cap: true,
  campaign_sms_start_hour: 9,
  campaign_sms_end_hour: 20,
  sms_opt_out_text: null,
}

function renderCard(card: "rules" | "optOut" = "rules") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      {card === "rules" ? <BulkMessageSettingsCard /> : <SmsOptOutCard />}
    </QueryClientProvider>
  )
}

const posts = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method)

describe("the bulk messages' settings (adr/0050)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_path: string, init?: { body?: object }) =>
      Promise.resolve({ section: "marketing", values: { ...STORED, ...init?.body }, version: 1 })
    )
  })

  it("turns the 24-hour limit off and moves the SMS hours, saving only what changed", async () => {
    const user = userEvent.setup()
    renderCard()
    const cap = await screen.findByRole("switch", { name: /24 saatte en çok bir toplu mesaj/ })
    expect(cap).toBeChecked()

    await user.click(cap)
    await user.click(screen.getByRole("combobox", { name: "Bitiş" }))
    await user.click(await screen.findByRole("option", { name: "21:00" }))
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(posts()).toHaveLength(1)
    })
    expect(posts()[0]).toEqual([
      "/admin/platform-settings/marketing",
      { method: "POST", body: { campaign_frequency_cap: false, campaign_sms_end_hour: 21 } },
    ])
  })

  it("does not save hours that end before they start", async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(await screen.findByRole("combobox", { name: "Başlangıç" }))
    await user.click(await screen.findByRole("option", { name: "21:00" }))

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bitiş saati başlangıç saatinden sonra olmalı."
    )
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeDisabled()
  })

  it("keeps the opt-out line every bulk SMS ends with", async () => {
    const user = userEvent.setup()
    renderCard("optOut")

    await user.type(
      await screen.findByLabelText("Ret metni"),
      "  Ret için RET yazıp 4609'a gönderin "
    )
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(posts()).toHaveLength(1)
    })
    expect(posts()[0]?.[1]).toEqual({
      method: "POST",
      body: { sms_opt_out_text: "Ret için RET yazıp 4609'a gönderin" },
    })
  })
})
