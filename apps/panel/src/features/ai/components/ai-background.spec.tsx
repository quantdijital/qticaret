import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MediaDetail } from "@/features/media/api/media"
import { GalleryTile } from "@/features/products/components/gallery-tile"

/**
 * docs/22 "Aşama 4" PR 4-2: "Arka planı temizle" on a product picture.
 * The job is asked for (202), followed, and its result shown beside the
 * original; "Kullan" adds it to the product, "Vazgeç" turns it down.
 */

const sdkFetch = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const task = (usable: string[], allowed = true) => ({
  id: "image_background",
  capability: "image_edit",
  mode: "job",
  options: ["transparent", "white"],
  allowed,
  usable,
  preference: null,
})
const service = (id: string, backgrounds: string[]) => ({
  id,
  capabilities: ["image_edit"],
  status: "connected",
  funding: "own_key",
  data_note_key: `ai.data_note.${id}`,
  backgrounds,
})
const SERVICES = {
  services: [service("photoroom", ["transparent", "white"]), service("gemini", ["white"])],
  tasks: [task(["photoroom"])],
  flags: { own_keys: true },
}

const RESULT: MediaDetail = {
  id: "media_new",
  url: "https://cdn.example.com/kupa-yz.png",
  file_id: "file_new",
  filename: "kupa-yz.png",
  mime_type: "image/png",
  size: 900,
  width: 800,
  height: 800,
  alt: null,
  ai_source: "edited",
  derived_from_id: "media_01",
  created_at: "2026-11-18T10:00:00.000Z",
  uploaded_by: null,
  usage: [],
  derived_from: { id: "media_01", url: "https://cdn.example.com/kupa.webp", filename: "kupa.webp" },
}

type Job = Record<string, unknown>
const DONE: Job = {
  id: "job_1",
  status: "succeeded",
  progress: 100,
  error_code: null,
  result_summary: {
    done: [{ media_id: "media_01", result_id: "media_new", suggestion_id: "sug_1" }],
    failed: [],
    skipped: 0,
    stopped_by: null,
  },
}
const RUNNING: Job = { ...DONE, status: "running", progress: 40, result_summary: null }

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const netFetch = vi.fn()
let services: unknown = SERVICES
let jobs: Job[] = []

function tile({ onAdd = vi.fn(), full = false } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <GalleryTile
        image={{
          key: "img_1",
          url: "https://cdn.example.com/kupa.webp",
          alt: { value: "Kupa", legacy: false, versions: "ready", mediaId: "media_01" },
        }}
        index={0}
        count={1}
        disabled={false}
        withAlt
        open
        onOpenChange={vi.fn()}
        dragging={false}
        target={false}
        drag={{ start: vi.fn(), over: vi.fn(), end: vi.fn(), drop: vi.fn() }}
        onMakeMain={vi.fn()}
        onMove={vi.fn()}
        onRemove={vi.fn()}
        onAlt={vi.fn()}
        onAddImage={onAdd}
        room={{ full, max: 20 }}
      />
    </QueryClientProvider>
  )
  return { user: userEvent.setup(), onAdd }
}

const posted = () => netFetch.mock.calls.map(([url]) => String(url))
const body = (at = 0): unknown =>
  JSON.parse((netFetch.mock.calls[at]?.[1] as { body: string }).body)

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Görseli düzenle" }))
  return screen.findByRole("dialog", { name: "Görseli düzenle" })
}

beforeEach(() => {
  services = SERVICES
  jobs = [RUNNING, DONE]
  netFetch.mockReset()
  netFetch.mockImplementation((url: string) =>
    url.endsWith("/accept") || url.endsWith("/dismiss")
      ? json(200, { suggestion: { id: "sug_1", text: "media_new" } })
      : json(202, { job_id: "job_1", service: "photoroom", alternatives: [] })
  )
  vi.stubGlobal("fetch", netFetch)
  sdkFetch.mockReset()
  sdkFetch.mockImplementation((url: string) => {
    if (url === "/admin/ai/services") {
      return Promise.resolve(services)
    }
    if (url.startsWith("/admin/async-jobs/")) {
      const next = jobs.length > 1 ? jobs.shift() : jobs[0]
      return Promise.resolve({ async_job: next })
    }
    return Promise.resolve({ media: RESULT })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("a product picture's background", () => {
  it("asks for a job (202), shows its progress, then the result beside the original", async () => {
    const { user } = tile()
    const dialog = await openDialog(user)
    expect(within(dialog).getByRole("radio", { name: "Şeffaf" })).toBeChecked()
    await user.click(within(dialog).getByRole("button", { name: "Arka planı temizle" }))
    expect(body()).toEqual({
      task: "image_background",
      entity_type: "media",
      entity_ids: ["media_01"],
      option: "transparent",
    })
    expect(await within(dialog).findByRole("progressbar", { name: "İlerleme" })).toBeInTheDocument()
    expect(
      await within(dialog).findByRole(
        "img",
        { name: "Arka planı temizlenmiş görsel" },
        { timeout: 3000 }
      )
    ).toHaveAttribute("src", RESULT.url)
    expect(within(dialog).getByRole("img", { name: "Asıl görsel" })).toBeInTheDocument()
    expect(within(dialog).getByText(/yeni görseli ürüne ekler/)).toBeInTheDocument()
  })

  it("Kullan adds the new picture to the product and records the decision", async () => {
    const { user, onAdd } = tile()
    jobs = [DONE]
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole("button", { name: "Arka planı temizle" }))
    await user.click(await within(dialog).findByRole("button", { name: "Kullan" }))
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({ id: "file_new", url: RESULT.url })
    })
    expect(posted()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/accept"])
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Görseli düzenle" })).not.toBeInTheDocument()
    })
  })

  it("Vazgeç turns the suggestion down and adds nothing", async () => {
    const { user, onAdd } = tile()
    jobs = [DONE]
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole("button", { name: "Arka planı temizle" }))
    await within(dialog).findByRole("button", { name: "Kullan" })
    await user.click(within(dialog).getByRole("button", { name: "Vazgeç" }))
    await waitFor(() => {
      expect(posted()).toContain("/admin/ai/suggestions/sug_1/dismiss")
    })
    expect(onAdd).not.toHaveBeenCalled()
  })

  it("offers transparent only with a service that makes it", async () => {
    services = { ...SERVICES, tasks: [task(["photoroom", "gemini"])] }
    const { user } = tile()
    const dialog = await openDialog(user)
    expect(within(dialog).getByRole("radio", { name: "Şeffaf" })).toBeInTheDocument()
    await user.click(within(dialog).getByRole("radio", { name: "Gemini" }))
    expect(within(dialog).queryByRole("radio", { name: "Şeffaf" })).not.toBeInTheDocument()
    expect(
      within(dialog).getByText("Gemini yalnız şu zemini yapar: Beyaz zemin.")
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Arka planı temizle" }))
    expect(body()).toMatchObject({ option: "white", service: "gemini" })
  })

  it("says why Kullan cannot add a 21st picture", async () => {
    const { user } = tile({ full: true })
    jobs = [DONE]
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole("button", { name: "Arka planı temizle" }))
    expect(await within(dialog).findByRole("button", { name: "Kullan" })).toBeDisabled()
    expect(within(dialog).getByText(/Üründe yer yok \(en çok 20 görsel\)/)).toBeInTheDocument()
  })

  it("shows a picture's failure, the package limit and a refused request in words", async () => {
    jobs = [
      {
        ...DONE,
        result_summary: {
          done: [],
          failed: [{ media_id: "media_01", key: "ai.provider_busy" }],
          skipped: 0,
          stopped_by: null,
        },
      },
    ]
    const { user } = tile()
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole("button", { name: "Arka planı temizle" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Photoroom şu an yoğun")

    jobs = [
      {
        ...DONE,
        result_summary: { done: [], failed: [], skipped: 1, stopped_by: "plan.limit_reached" },
      },
    ]
    await user.click(within(dialog).getByRole("button", { name: "Yeniden dene" }))
    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toHaveTextContent("Paket sınırına ulaşıldı")
    })

    netFetch.mockImplementation(() =>
      json(400, { code: "ai.daily_limit_reached", message: "ai.daily_limit_reached" })
    )
    await user.click(within(dialog).getByRole("button", { name: "Yeniden dene" }))
    await waitFor(() => {
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Bugünkü yapay zekâ kullanım sınırına"
      )
    })
  })

  it("with no service says how to get one instead of asking", async () => {
    services = { ...SERVICES, tasks: [task([])] }
    const first = tile()
    const dialog = await openDialog(first.user)
    expect(within(dialog).getByText(/arka planı tek tıkla temizleyebilirsiniz/)).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: "Bağla" })).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", { name: "Arka planı temizle" })
    ).not.toBeInTheDocument()
  })

  it("draws no action for a role the task does not allow", async () => {
    services = { ...SERVICES, tasks: [task(["photoroom"], false)] }
    tile()
    expect(await screen.findByLabelText("1. görsel")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Görseli düzenle" })).not.toBeInTheDocument()
  })
})
