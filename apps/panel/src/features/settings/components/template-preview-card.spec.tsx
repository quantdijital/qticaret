import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MessagePreview, MessageTemplateSummary } from "@/features/settings/api/messaging"
import { TemplatePreviewCard } from "./template-preview-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

const templates: MessageTemplateSummary[] = [
  // A customer's message is edited in its own tab (adr/0036 Ek 2026-11-10): not listed here
  { name: "order.placed", kind: "transactional", channels: ["email", "sms"] },
  { name: "staff.new_order", kind: "transactional", channels: ["email"] },
  { name: "staff.seo_digest", kind: "transactional", channels: ["email"] },
]

const previews: Record<string, MessagePreview> = {
  "staff.new_order": {
    name: "staff.new_order",
    kind: "transactional",
    email: {
      subject: "Yeni sipariş #1001 (₺389,80)",
      html: "<!doctype html><p>Ayşe sipariş verdi</p><script>parent.hacked = true</script>",
      text: "Ayşe sipariş verdi",
    },
    sms: null,
  },
  "staff.seo_digest": {
    name: "staff.seo_digest",
    kind: "transactional",
    email: {
      subject: "Haftalık SEO özeti: ortalama 82/100",
      html: "<p>SEO</p>",
      text: "SEO",
    },
    sms: null,
  },
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TemplatePreviewCard />
    </QueryClientProvider>
  )
}

describe("TemplatePreviewCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((path: string) => {
      if (path === "/admin/messaging/templates") {
        return Promise.resolve({ templates })
      }
      const name = decodeURIComponent(path.split("/")[4] ?? "")
      return Promise.resolve(previews[name])
    })
  })

  it("shows the first team message's e-mail in a frame that runs nothing", async () => {
    renderCard()

    expect(await screen.findByText("Yeni sipariş #1001 (₺389,80)")).toBeInTheDocument()
    const frame = screen.getByTitle("Ekip: yeni sipariş e-postasının önizlemesi")
    expect(frame).toHaveAttribute("sandbox", "")
    expect(frame.getAttribute("srcdoc")).toContain("Ayşe sipariş verdi")
    expect(screen.getByText("Bilgilendirme")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/messaging/templates/staff.new_order/preview")
  })

  it("lists the team's messages only, and previews the one chosen", async () => {
    renderCard()
    await screen.findByText("Yeni sipariş #1001 (₺389,80)")

    await userEvent.click(screen.getByRole("combobox", { name: "Şablon" }))
    const options = within(screen.getByRole("listbox")).getAllByRole("option")
    expect(options.map((option) => option.textContent)).toEqual([
      "Ekip: yeni sipariş",
      "Ekip: haftalık SEO özeti",
    ])
    await userEvent.click(
      within(screen.getByRole("listbox")).getByRole("option", { name: "Ekip: haftalık SEO özeti" })
    )

    expect(await screen.findByText("Haftalık SEO özeti: ortalama 82/100")).toBeInTheDocument()
  })
})
