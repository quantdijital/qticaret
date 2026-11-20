import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AiGuidanceSettings } from "@/features/ai/api/guidance"
import { AiGuidanceTab } from "./ai-guidance-tab"

/**
 * Settings › Yapay zekâ › Yazım yönergesi (adr/0074 §2): tone and address
 * with their defaults on top, the audience, the free guidance and the word
 * chips in one card; every text task a closed row below with its extra
 * note and up to three examples. Each card saves its own fields to the
 * `ai_guidance` section; owner and admin only.
 */

const fetchMock = vi.hoisted(() => vi.fn())
const can = vi.hoisted(() => ({ settings: true }))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => can.settings }))

let values: AiGuidanceSettings
const saves: Partial<AiGuidanceSettings>[] = []

beforeEach(() => {
  can.settings = true
  saves.length = 0
  values = {
    tone: "warm",
    address: "siz",
    audience: null,
    guide: null,
    prefer: ["el yapımı"],
    avoid: [],
    tasks: { seo_title: { extra: "Marka adını sona koy", examples: [] } },
  }
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    if (url === "/admin/platform-settings/ai_guidance" && init?.method === "POST") {
      const sent = init.body as Partial<AiGuidanceSettings>
      saves.push(sent)
      values = { ...values, ...sent, tasks: { ...values.tasks, ...sent.tasks } }
    }
    return Promise.resolve({ section: "ai_guidance", values, version: 1 })
  })
})

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AiGuidanceTab />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

describe("AiGuidanceTab", () => {
  it("shows the defaults chosen, the saved words and every text task closed", async () => {
    renderTab()
    expect(await screen.findByRole("combobox", { name: "Ton" })).toHaveTextContent(
      "Samimi ama ölçülü"
    )
    expect(screen.getByRole("radio", { name: "Siz" })).toBeChecked()
    expect(screen.getByText("el yapımı")).toBeInTheDocument()
    // No save bar until something changes
    for (const save of screen.getAllByRole("button", { name: "Kaydet", hidden: true })) {
      expect(save.parentElement).toHaveClass("hidden")
    }

    const row = screen.getByText("Arama başlığı").closest("details")
    expect(row).not.toHaveAttribute("open")
    expect(row?.querySelector("summary")).toHaveTextContent("Arama başlığıEk yönerge")
    expect(screen.getByText("Ürün açıklaması")).toBeInTheDocument()
    expect(screen.queryByText("Arka plan temizleme")).not.toBeInTheDocument()
  })

  it("saves the shop-wide part: address, audience, a word added by Enter", async () => {
    const user = renderTab()
    await user.click(await screen.findByRole("radio", { name: "Sen" }))
    await user.type(screen.getByLabelText("Hedef kitle"), "kamp severler")
    await user.type(screen.getByLabelText("Kaçınılacak sözcükler"), "ucuz{Enter}")
    const card = screen.getByRole("radio", { name: "Sen" }).closest("form") as HTMLElement
    await user.click(within(card).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(saves).toHaveLength(1)
    })
    expect(saves[0]).toEqual({
      tone: "warm",
      address: "sen",
      audience: "kamp severler",
      guide: null,
      prefer: ["el yapımı"],
      avoid: ["ucuz"],
    })
  })

  it("holds a word over 40 characters and a 21st word back with the reason", async () => {
    values.avoid = Array.from({ length: 20 }, (_, i) => `s${String(i)}`)
    const user = renderTab()
    const avoid = await screen.findByLabelText("Kaçınılacak sözcükler")
    await user.type(avoid, `${"a".repeat(41)}{Enter}`)
    expect(screen.getByText("Bir sözcük en çok 40 karakter olabilir.")).toBeInTheDocument()
    await user.clear(avoid)
    await user.type(avoid, "yeni{Enter}")
    expect(screen.getByText("En çok 20 sözcük eklenebilir.")).toBeInTheDocument()
  })

  it("saves a task's note and examples, every task sent, a cleared one empty", async () => {
    const user = renderTab()
    await user.click(await screen.findByText("Arama açıklaması"))
    const row = screen.getByText("Arama açıklaması").closest("details") as HTMLElement
    await user.click(within(row).getByRole("button", { name: "Örnek ekle" }))
    await user.type(within(row).getByLabelText("Örnek 1"), "Kısa ve net bir örnek.")
    await user.click(screen.getByText("Arama başlığı"))
    const title = screen.getByText("Arama başlığı").closest("details") as HTMLElement
    await user.clear(within(title).getByLabelText("Ek yönerge"))
    const card = row.closest("form") as HTMLElement
    await user.click(within(card).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(saves).toHaveLength(1)
    })
    const tasks = saves[0]?.tasks ?? {}
    expect(Object.keys(tasks)).toHaveLength(8)
    expect(tasks["seo_description"]).toEqual({
      extra: null,
      examples: ["Kısa ve net bir örnek."],
    })
    expect(tasks["seo_title"]).toEqual({ extra: null, examples: [] })
  })

  it("offers at most three examples a task", async () => {
    values.tasks = { product_title: { extra: null, examples: ["bir", "iki", "üç"] } }
    const user = renderTab()
    await user.click(await screen.findByText("Ürün adı"))
    const row = screen.getByText("Ürün adı").closest("details") as HTMLElement
    expect(within(row).getAllByRole("textbox")).toHaveLength(4)
    expect(within(row).queryByRole("button", { name: "Örnek ekle" })).not.toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: "Örnek 2 kaldır" }))
    expect(within(row).getByRole("button", { name: "Örnek ekle" })).toBeInTheDocument()
  })

  it("is read only for a role that may not change settings", async () => {
    can.settings = false
    renderTab()
    expect(await screen.findByText(/mağaza sahibi ya da yönetici değiştirir/)).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Ton" })).toBeDisabled()
    expect(screen.getByLabelText("Hedef kitle")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Örnek ekle" })).not.toBeInTheDocument()
  })
})
