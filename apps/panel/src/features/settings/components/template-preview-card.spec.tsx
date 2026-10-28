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
  { name: "order.placed", kind: "transactional", channels: ["email", "sms"] },
  { name: "marketing.announcement", kind: "commercial", channels: ["email", "sms"] },
]

const previews: Record<string, MessagePreview> = {
  "order.placed": {
    name: "order.placed",
    kind: "transactional",
    email: {
      subject: "Siparişiniz alındı: #1001",
      html: "<!doctype html><p>Merhaba Ayşe</p><script>parent.hacked = true</script>",
      text: "Merhaba Ayşe",
    },
    sms: "Örnek Mağaza: #1001 numaralı siparişiniz alındı.",
  },
  "marketing.announcement": {
    name: "marketing.announcement",
    kind: "commercial",
    email: { subject: "Yeni sezon geldi", html: "<p>Yeni sezon</p>", text: "Yeni sezon" },
    sms: "Yeni sezon geldi. Ret için RET yazın.",
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

  it("shows the first template's e-mail in a frame that runs nothing, and its SMS", async () => {
    renderCard()

    expect(await screen.findByText("Siparişiniz alındı: #1001")).toBeInTheDocument()
    const frame = screen.getByTitle("Sipariş alındı e-postasının önizlemesi")
    expect(frame).toHaveAttribute("sandbox", "")
    expect(frame.getAttribute("srcdoc")).toContain("Merhaba Ayşe")
    expect(screen.getByText("Örnek Mağaza: #1001 numaralı siparişiniz alındı.")).toBeInTheDocument()
    expect(screen.getByText("Bilgilendirme")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/messaging/templates/order.placed/preview")
  })

  it("previews the template chosen and says a commercial one needs consent", async () => {
    renderCard()
    await screen.findByText("Siparişiniz alındı: #1001")

    await userEvent.click(screen.getByRole("combobox", { name: "Şablon" }))
    await userEvent.click(
      within(screen.getByRole("listbox")).getByRole("option", { name: "Kampanya duyurusu" })
    )

    expect(await screen.findByText("Yeni sezon geldi")).toBeInTheDocument()
    expect(screen.getByText("Ticari")).toBeInTheDocument()
    expect(screen.getByText(/izin veren alıcılara/)).toBeInTheDocument()
    expect(screen.getByText("37 karakter")).toBeInTheDocument()
  })
})
