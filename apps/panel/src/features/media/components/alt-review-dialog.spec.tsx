import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AltReviewDialog } from "@/features/media/components/alt-review-dialog"

/**
 * docs/22 "Aşama 5", PR 5-2: the library's alt text review. Kullan saves
 * the field's text to the image, then marks the suggestion accepted;
 * Vazgeç dismisses it; Tümünü kullan does each in turn.
 */

const sdkFetch = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const task = (usable: string[]) => ({
  services: [],
  tasks: [
    {
      id: "image_alt_text",
      capability: "vision",
      mode: "sync",
      options: [],
      allowed: true,
      usable,
      preference: null,
    },
  ],
  flags: { own_keys: true },
})

const open = (id: string, mediaId: string, filename: string, text: string) => ({
  id,
  service: "gemini",
  text,
  created_at: "2026-11-18T10:00:00.000Z",
  media: { id: mediaId, url: `https://cdn.example.com/${filename}`, filename, alt: null },
})

const KUPA = open("cdraft_1", "media_1", "kupa.webp", "Ahşap masada beyaz kupa")
const TABAK = open("cdraft_2", "media_2", "tabak.webp", "Mavi desenli porselen tabak")

let services = task(["gemini"])
let suggestions = [KUPA, TABAK]
let saveFails = false
const netFetch = vi.fn()

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AltReviewDialog open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

const saves = () =>
  sdkFetch.mock.calls.filter(([url, init]) => {
    const method = (init as { method?: string } | undefined)?.method
    return String(url).startsWith("/admin/media/") && method === "POST"
  })
const decisions = () => netFetch.mock.calls.map(([url]) => String(url))

beforeEach(() => {
  services = task(["gemini"])
  suggestions = [KUPA, TABAK]
  saveFails = false
  vi.mocked(toast.error).mockReset()
  netFetch.mockReset()
  netFetch.mockImplementation((url: string) => {
    const id = url.split("/").at(-2) ?? ""
    suggestions = suggestions.filter((each) => each.id !== id)
    return json(200, { suggestion: { id, text: "x" } })
  })
  vi.stubGlobal("fetch", netFetch)
  sdkFetch.mockReset()
  sdkFetch.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    if (url === "/admin/ai/services") {
      return Promise.resolve(services)
    }
    if (url === "/admin/ai/suggestions") {
      return Promise.resolve({ suggestions })
    }
    if (url.startsWith("/admin/media/") && init?.method === "POST") {
      return saveFails
        ? Promise.reject(Object.assign(new Error("boom"), { status: 500 }))
        : Promise.resolve({ media: {} })
    }
    if (url === "/admin/media") {
      return Promise.resolve({
        media: [
          { id: "media_9", file_id: "f9", mime_type: "image/png", alt: null },
          { id: "media_8", file_id: "f8", mime_type: "image/png", alt: "Var" },
          { id: "media_7", file_id: "f7", mime_type: "image/svg+xml", alt: null },
          { id: "media_1", file_id: "f1", mime_type: "image/webp", alt: null },
        ],
        count: 4,
      })
    }
    if (url === "/admin/async-jobs") {
      return Promise.resolve({ async_job: { id: "job_1", status: "queued", progress: 0 } })
    }
    return Promise.resolve({
      async_job: {
        id: "job_1",
        status: "succeeded",
        progress: 100,
        error_message: null,
        result_summary: {
          asked: 1,
          suggested: 1,
          refused: 0,
          failed: 0,
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

describe("the alt text review", () => {
  it("lists each waiting suggestion with its picture and an editable text", async () => {
    show()
    const list = await screen.findByRole("region", { name: "Bekleyen alt metin önerileri" })
    expect(within(list).getByText("2 öneri onay bekliyor")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "kupa.webp için alt metin" })).toHaveValue(KUPA.text)
    expect(screen.getByRole("button", { name: "tabak.webp için öneriyi kullan" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Tümünü kullan" })).toBeEnabled()
  })

  it("saves the edited text to the image, then accepts the suggestion", async () => {
    const user = show()
    const field = await screen.findByRole("textbox", { name: "kupa.webp için alt metin" })
    await user.clear(field)
    await user.type(field, "Beyaz kupa, ahşap masa")
    await user.click(screen.getByRole("button", { name: "kupa.webp için öneriyi kullan" }))

    await waitFor(() => {
      expect(decisions()).toEqual(["/admin/ai/suggestions/cdraft_1/accept"])
    })
    expect(saves()).toEqual([
      ["/admin/media/media_1", { method: "POST", body: { alt: "Beyaz kupa, ahşap masa" } }],
    ])
    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: "kupa.webp için alt metin" })).toBeNull()
    })
  })

  it("dismisses a suggestion without touching the image", async () => {
    const user = show()
    await user.click(await screen.findByRole("button", { name: "tabak.webp için öneriden vazgeç" }))
    await waitFor(() => {
      expect(decisions()).toEqual(["/admin/ai/suggestions/cdraft_2/dismiss"])
    })
    expect(saves()).toEqual([])
  })

  it("uses all, each saved then accepted in turn", async () => {
    const user = show()
    await user.click(await screen.findByRole("button", { name: "Tümünü kullan" }))
    await waitFor(() => {
      expect(decisions()).toEqual([
        "/admin/ai/suggestions/cdraft_1/accept",
        "/admin/ai/suggestions/cdraft_2/accept",
      ])
    })
    expect(saves().map(([url]) => String(url))).toEqual([
      "/admin/media/media_1",
      "/admin/media/media_2",
    ])
    expect(await screen.findByText("Bekleyen öneri yok.")).toBeInTheDocument()
  })

  it("keeps the suggestion open when the image could not be saved", async () => {
    saveFails = true
    const user = show()
    await user.click(await screen.findByRole("button", { name: "kupa.webp için öneriyi kullan" }))
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("kupa.webp kaydedilemedi"))
    })
    expect(decisions()).toEqual([])
    expect(screen.getByRole("textbox", { name: "kupa.webp için alt metin" })).toBeInTheDocument()
  })

  it("starts the job for library images with no alt text and none waiting", async () => {
    services = task(["gemini", "deepseek"])
    const user = show()
    await screen.findByRole("region", { name: "Bekleyen alt metin önerileri" })
    await user.click(screen.getByRole("radio", { name: "DeepSeek" }))
    await user.click(screen.getByRole("button", { name: "Alt metni boş görseller için öner" }))

    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/async-jobs", {
        method: "POST",
        body: { type: "ai.alt_text", input: { media_ids: ["media_9"], service: "deepseek" } },
      })
    })
    expect(await screen.findByText("1 öneri hazırlandı.")).toBeInTheDocument()
  })

  it("shows the empty list and the connect tip when no service can do it", async () => {
    services = task([])
    suggestions = []
    show()
    expect(await screen.findByText("Bekleyen öneri yok.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Bağla" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Alt metni boş görseller için öner" })).toBeNull()
  })
})
