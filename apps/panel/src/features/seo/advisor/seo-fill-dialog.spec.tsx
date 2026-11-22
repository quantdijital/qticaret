import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SeoFillButton } from "@/features/seo/advisor/seo-fill-button"

/**
 * adr/0074 §5 madde 7 (G7): the bulk SEO fill. One button with the count
 * opens the dialog; the job starts with both fields unless the options
 * say otherwise; Kullan saves the field through the page's SEO save, then
 * accepts the candidate taken; nothing is saved otherwise.
 */

const sdkFetch = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const task = (usable: string[], allowed = true) => ({
  services: [],
  tasks: [
    {
      id: "seo_title",
      capability: "text",
      mode: "sync",
      options: [],
      allowed,
      usable,
      preference: null,
    },
  ],
  flags: { own_keys: true },
})

const open = (id: string, taskId: string, name: string, candidates: string[]) => ({
  id,
  task: taskId,
  service: "gemini",
  candidates,
  created_at: "2026-11-22T10:00:00.000Z",
  entity: { type: "product", id: `prod_${id}`, name, current: null },
})

const GOMLEK = open("cdraft_1", "seo_title", "Keten Gömlek", [
  "Keten Gömlek Yazlık, Rahat Kesim",
  "Yazlık Keten Gömlek: Nefes Alan Kumaş",
])
const KUPA = open("cdraft_2", "seo_description", "Kupa", [
  "Ahşap masada beyaz kupa; her güne uyan sade bir tasarım.",
])

let services = task(["gemini"])
let suggestions = [GOMLEK, KUPA]
let saveFails = false
const COUNT = { pages: 12, title: 8, description: 12, max: 50 }
let counted: Record<string, unknown> = COUNT
const netFetch = vi.fn()

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

async function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SeoFillButton />
    </QueryClientProvider>
  )
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole("button", { name: "Eksik metaları yapay zekâ ile doldur (12)" })
  )
  return user
}

const saves = () =>
  sdkFetch.mock.calls.filter(([url, init]) => {
    const method = (init as { method?: string } | undefined)?.method
    return String(url).startsWith("/admin/seo/") && method === "PUT"
  })
const decisions = () =>
  netFetch.mock.calls.map(([url, init]) => [String(url), (init as { body?: string }).body])

beforeEach(() => {
  services = task(["gemini"])
  suggestions = [GOMLEK, KUPA]
  saveFails = false
  counted = COUNT
  vi.mocked(toast.error).mockReset()
  netFetch.mockReset()
  netFetch.mockImplementation((url: string) => {
    const id = url.split("/").at(-2) ?? ""
    suggestions = suggestions.filter((each) => each.id !== id)
    return json(200, { suggestion: { id, text: "x" } })
  })
  vi.stubGlobal("fetch", netFetch)
  sdkFetch.mockReset()
  sdkFetch.mockImplementation((url: string, init?: { method?: string }) => {
    if (url === "/admin/ai/services") {
      return Promise.resolve(services)
    }
    if (url === "/admin/ai/seo-fill" && init?.method === "POST") {
      return Promise.resolve({ job_id: "job_1", pages: 12, asks: 20 })
    }
    if (url === "/admin/ai/seo-fill") {
      return Promise.resolve(counted)
    }
    if (url === "/admin/ai/seo-fill/suggestions") {
      return Promise.resolve({ suggestions })
    }
    if (url.startsWith("/admin/seo/") && init?.method === "PUT") {
      return saveFails
        ? Promise.reject(Object.assign(new Error("boom"), { status: 500 }))
        : Promise.resolve({ seo: {}, duplicates: { seo_title: 0, seo_description: 0 } })
    }
    return Promise.resolve({
      async_job: {
        id: "job_1",
        status: "succeeded",
        progress: 100,
        error_message: null,
        result_summary: {
          pages: 12,
          asked: 20,
          suggested: 18,
          refused: 1,
          failed: 1,
          skipped: 0,
          not_asked: 0,
          stopped: null,
        },
      },
    })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("the bulk SEO fill", () => {
  it("draws nothing for a role the search text tasks do not allow", async () => {
    services = task(["gemini"], false)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <SeoFillButton />
      </QueryClientProvider>
    )
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/services")
    })
    expect(screen.queryByRole("button", { name: /Eksik metaları/ })).toBeNull()
    expect(sdkFetch).not.toHaveBeenCalledWith("/admin/ai/seo-fill")
  })

  it("lists each waiting suggestion with its page, candidates and an editable text", async () => {
    await show()
    const list = await screen.findByRole("region", { name: "Bekleyen arama metni önerileri" })
    expect(within(list).getByText("2 öneri onay bekliyor")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Keten Gömlek, Arama başlığı" })).toHaveValue(
      GOMLEK.candidates[0]
    )
    expect(screen.getByRole("group", { name: "Keten Gömlek için adaylar" })).toBeInTheDocument()
    // One candidate: nothing to pick between
    expect(screen.queryByRole("group", { name: "Kupa için adaylar" })).toBeNull()
    expect(saves()).toEqual([])
  })

  it("saves the picked candidate to the page's field, then accepts it by its place", async () => {
    const user = await show()
    await user.click(await screen.findByRole("button", { name: GOMLEK.candidates[1] ?? "" }))
    expect(screen.getByRole("textbox", { name: "Keten Gömlek, Arama başlığı" })).toHaveValue(
      GOMLEK.candidates[1]
    )
    await user.click(
      screen.getByRole("button", { name: "Keten Gömlek, Arama başlığı: öneriyi kullan" })
    )

    await waitFor(() => {
      expect(decisions()).toEqual([
        ["/admin/ai/suggestions/cdraft_1/accept", JSON.stringify({ candidate_index: 1 })],
      ])
    })
    expect(saves()).toEqual([
      [
        "/admin/seo/product/prod_cdraft_1",
        { method: "PUT", body: { seo_title: GOMLEK.candidates[1] } },
      ],
    ])
  })

  it("saves an edited text as typed", async () => {
    const user = await show()
    const field = await screen.findByRole("textbox", { name: "Kupa, Arama açıklaması" })
    await user.clear(field)
    await user.type(field, "Beyaz kupa, ahşap masa")
    await user.click(screen.getByRole("button", { name: "Kupa, Arama açıklaması: öneriyi kullan" }))
    await waitFor(() => {
      expect(saves()).toEqual([
        [
          "/admin/seo/product/prod_cdraft_2",
          { method: "PUT", body: { seo_description: "Beyaz kupa, ahşap masa" } },
        ],
      ])
    })
  })

  it("dismisses a suggestion without touching the page", async () => {
    const user = await show()
    await user.click(
      await screen.findByRole("button", { name: "Kupa, Arama açıklaması: öneriden vazgeç" })
    )
    await waitFor(() => {
      expect(decisions().map(([url]) => url)).toEqual(["/admin/ai/suggestions/cdraft_2/dismiss"])
    })
    expect(saves()).toEqual([])
  })

  it("uses all, each saved then accepted in turn", async () => {
    const user = await show()
    await user.click(await screen.findByRole("button", { name: "Tümünü kullan" }))
    await waitFor(() => {
      expect(decisions().map(([url]) => url)).toEqual([
        "/admin/ai/suggestions/cdraft_1/accept",
        "/admin/ai/suggestions/cdraft_2/accept",
      ])
    })
    expect(saves()).toHaveLength(2)
    expect(await screen.findByText("Bekleyen öneri yok.")).toBeInTheDocument()
  })

  it("keeps the suggestion open when the page could not be saved", async () => {
    saveFails = true
    const user = await show()
    await user.click(
      await screen.findByRole("button", { name: "Keten Gömlek, Arama başlığı: öneriyi kullan" })
    )
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Keten Gömlek kaydedilemedi")
      )
    })
    expect(decisions()).toEqual([])
  })

  it("starts the job for both fields, or only what the options say, with the service picked", async () => {
    services = task(["gemini", "deepseek"])
    const user = await show()
    await user.click(await screen.findByRole("button", { name: "12 sayfa için öner" }))
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/seo-fill", {
        method: "POST",
        body: { scope: "both", service: "gemini" },
      })
    })
    expect(await screen.findByText("18 öneri hazırlandı.")).toBeInTheDocument()
    expect(screen.getByText("2 alan için öneri çıkmadı.")).toBeInTheDocument()

    await user.click(screen.getByText("Seçenekler"))
    await user.click(screen.getByRole("radio", { name: "Yalnız arama başlığı" }))
    await user.click(screen.getByRole("radio", { name: "DeepSeek" }))
    await user.click(screen.getByRole("button", { name: "8 sayfa için öner" }))
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/seo-fill", {
        method: "POST",
        body: { scope: "title", service: "deepseek" },
      })
    })
  })

  it("takes one job's worth and shows a capped total with a plus", async () => {
    counted = { pages: 5000, title: 5000, description: 5000, max: 50, capped: true }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <SeoFillButton />
      </QueryClientProvider>
    )
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", { name: "Eksik metaları yapay zekâ ile doldur (50)" })
    )
    expect(await screen.findByRole("button", { name: "50 sayfa için öner" })).toBeEnabled()
    expect(screen.getByText(/toplam 5000\+ sayfa var/)).toBeInTheDocument()
  })

  it("shows the connect tip and no start when no service can do it", async () => {
    services = task([])
    suggestions = []
    await show()
    expect(await screen.findByText("Bekleyen öneri yok.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Bağla" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /sayfa için öner/ })).toBeNull()
  })
})
