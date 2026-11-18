import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MediaDetail } from "@/features/media/api/media"
import { MediaBackgroundAction, MediaDerivedFact } from "@/features/media/components/media-ai-edit"

/**
 * docs/22 "Aşama 4" PR 4-2 in the media library: "Kullan" keeps the new
 * picture in the library; an AI version shows its mark and its original,
 * or that the original is gone (adr/0071 D3: no foreign key).
 */

const sdkFetch = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const SERVICES = {
  services: [
    {
      id: "photoroom",
      capabilities: ["image_edit"],
      status: "connected",
      funding: "own_key",
      data_note_key: "ai.data_note.photoroom",
      backgrounds: ["transparent", "white"],
    },
  ],
  tasks: [
    {
      id: "image_background",
      capability: "image_edit",
      mode: "job",
      options: ["transparent", "white"],
      allowed: true,
      usable: ["photoroom"],
      preference: null,
    },
  ],
  flags: { own_keys: true },
}

const ORIGINAL: MediaDetail = {
  id: "media_01",
  url: "https://cdn.example.com/kupa.webp",
  file_id: "file_01",
  filename: "kupa.webp",
  mime_type: "image/webp",
  size: 1000,
  width: 800,
  height: 800,
  alt: null,
  ai_source: null,
  derived_from_id: null,
  created_at: "2026-11-18T10:00:00.000Z",
  uploaded_by: null,
  usage: [],
  derived_from: null,
}

const RESULT: MediaDetail = {
  ...ORIGINAL,
  id: "media_new",
  url: "https://cdn.example.com/kupa-yz.png",
  file_id: "file_new",
  filename: "kupa-yz.png",
  mime_type: "image/png",
  ai_source: "edited",
  derived_from_id: "media_01",
  derived_from: { id: "media_01", url: ORIGINAL.url, filename: "kupa.webp" },
}

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const netFetch = vi.fn()

beforeEach(() => {
  netFetch.mockReset()
  netFetch.mockImplementation((url: string) =>
    url.endsWith("/accept")
      ? json(200, { suggestion: { id: "sug_1", text: "media_new" } })
      : json(202, { job_id: "job_1", service: "photoroom", alternatives: [] })
  )
  vi.stubGlobal("fetch", netFetch)
  sdkFetch.mockReset()
  sdkFetch.mockImplementation((url: string, init?: { method?: string }) => {
    if (url === "/admin/ai/services") {
      return Promise.resolve(SERVICES)
    }
    if (url.startsWith("/admin/async-jobs/")) {
      return Promise.resolve({
        async_job: {
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
        },
      })
    }
    if (url === "/admin/media" && init?.method === "POST") {
      return Promise.resolve({ media: [RESULT] })
    }
    return Promise.resolve({ media: RESULT })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("a library picture's background", () => {
  it("Kullan keeps the new picture in the library, the original untouched", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MediaBackgroundAction media={ORIGINAL} />
      </QueryClientProvider>
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "Görseli düzenle" }))
    const dialog = await screen.findByRole("dialog", { name: "Görseli düzenle" })
    await user.click(within(dialog).getByRole("button", { name: "Arka planı temizle" }))
    const use = await within(dialog).findByRole("button", { name: "Kullan" })
    expect(within(dialog).getByText(/yeni görseli kütüphanede tutar/)).toBeInTheDocument()
    await user.click(use)
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/media", {
        method: "POST",
        body: { file_ids: ["file_new"], library: true },
      })
    })
    // Nothing written to the original: no route with its id was called to change it
    const writes = sdkFetch.mock.calls.filter(
      (call) => (call[1] as { method?: string } | undefined)?.method
    )
    expect(writes).toHaveLength(1)
    expect(netFetch.mock.calls.map(([url]) => String(url))).toEqual([
      "/admin/ai/suggestions",
      "/admin/ai/suggestions/sug_1/accept",
    ])
  })

  it("draws no button for an SVG or a picture with no stored file", () => {
    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <MediaBackgroundAction media={{ ...ORIGINAL, mime_type: "image/svg+xml" }} />
        <MediaBackgroundAction media={{ ...ORIGINAL, file_id: null }} />
      </QueryClientProvider>
    )
    expect(screen.queryByRole("button", { name: "Görseli düzenle" })).not.toBeInTheDocument()
  })
})

describe("an AI version in the library", () => {
  const fact = (media: MediaDetail) => {
    render(
      <dl>
        <MediaDerivedFact media={media} />
      </dl>
    )
  }

  it("shows the mark and the original it was made from", () => {
    fact(RESULT)
    expect(screen.getByText("Yapay zekâyla düzenlendi")).toBeInTheDocument()
    expect(screen.getByText("Türetilmiş: kupa.webp")).toBeInTheDocument()
  })

  it("says the original is gone once deleted, the version intact", () => {
    fact({ ...RESULT, derived_from: null })
    expect(screen.getByText("Yapay zekâyla düzenlendi")).toBeInTheDocument()
    expect(screen.getByText("Asıl görsel yok (silinmiş).")).toBeInTheDocument()
  })

  it("draws nothing for a picture people made", () => {
    fact(ORIGINAL)
    expect(screen.queryByText("Yapay zekâyla düzenlendi")).not.toBeInTheDocument()
  })
})
