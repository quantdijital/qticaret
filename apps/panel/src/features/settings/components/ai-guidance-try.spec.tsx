import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import type { AiGuidanceSettings } from "@/features/ai/api/guidance"
import { AiGuidanceTab } from "./ai-guidance-tab"

/**
 * "Dene" on the writing guidance page (adr/0074 §2): a product and a task
 * picked, the guidance as the cards hold it (not saved) sent to the
 * preview route, and the two suggestions shown side by side, without
 * and with the guidance. Owner and admin only.
 */

const fetchMock = vi.hoisted(() => vi.fn())
const can = vi.hoisted(() => ({ settings: true }))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => can.settings }))
// The product search reads the server; here it offers one product
vi.mock("@qticaret/admin-ui/patterns/search-picker", () => ({
  SearchPicker: ({
    value,
    onChange,
  }: {
    value: PickerOption | null
    onChange: (value: PickerOption | null) => void
  }) => (
    <div>
      <span data-testid="picked">{value?.label ?? "—"}</span>
      <button
        type="button"
        onClick={() => {
          onChange({ id: "prod_1", label: "Keten Gömlek" })
        }}
      >
        pick product
      </button>
    </div>
  ),
}))

const saved: AiGuidanceSettings = {
  tone: "warm",
  address: "siz",
  audience: null,
  guide: "Kayıtlı yönerge",
  prefer: [],
  avoid: [],
  tasks: {},
}

const posted: { url: string; body: Record<string, unknown> }[] = []
let answer: { status: number; body: unknown }

beforeEach(() => {
  can.settings = true
  posted.length = 0
  answer = {
    status: 200,
    body: {
      preview: {
        task: "seo_title",
        plain: {
          status: "succeeded",
          candidates: ["Düz başlık bir", "Düz başlık iki"],
          problems: [],
        },
        guided: { status: "refused", candidates: [], problems: ["length"] },
      },
    },
  }
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ section: "ai_guidance", values: saved, version: 1 })
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: { body: string }) => {
      posted.push({ url, body: JSON.parse(init.body) as Record<string, unknown> })
      return Promise.resolve({
        ok: answer.status < 400,
        status: answer.status,
        statusText: "",
        json: () => Promise.resolve(answer.body),
      })
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
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

describe("AiGuidanceTry", () => {
  it("sends the guidance as the form holds it, unsaved, and shows both sides", async () => {
    const user = renderTab()
    const guide = await screen.findByRole("textbox", { name: "Serbest yönerge" })
    await user.clear(guide)
    await user.type(guide, "Kaydedilmemiş yönerge")
    const run = screen.getByRole("button", { name: "Dene" })
    expect(run).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "pick product" }))
    await user.click(run)

    await waitFor(() => {
      expect(posted).toHaveLength(1)
    })
    expect(posted[0]?.url).toBe("/admin/ai/guidance/preview")
    expect(posted[0]?.body).toMatchObject({
      task: "seo_title",
      product_id: "prod_1",
      guidance: { tone: "warm", address: "siz", guide: "Kaydedilmemiş yönerge" },
    })
    // Nothing saved by trying
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/platform-settings/ai_guidance",
      expect.objectContaining({ method: "POST" })
    )
    const plain = await screen.findByRole("region", { name: "Yönergesiz" })
    expect(within(plain).getByText("Düz başlık bir")).toBeInTheDocument()
    expect(within(plain).getByText("Düz başlık iki")).toBeInTheDocument()
    const guided = screen.getByRole("region", { name: "Yönergeyle" })
    expect(within(guided).getByText(/denetimden geçmedi/)).toBeInTheDocument()
  })

  it("says why a try failed in our words", async () => {
    answer = { status: 400, body: { message: "ai.guidance_too_long", type: "invalid_data" } }
    const user = renderTab()
    await user.click(await screen.findByRole("button", { name: "pick product" }))
    await user.click(screen.getByRole("button", { name: "Dene" }))
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Yönergesiz" })).not.toBeInTheDocument()
  })

  it("is not offered to a role that cannot change the guidance", async () => {
    can.settings = false
    renderTab()
    await screen.findByRole("combobox", { name: "Ton" })
    expect(screen.queryByRole("button", { name: "Dene" })).not.toBeInTheDocument()
  })
})
