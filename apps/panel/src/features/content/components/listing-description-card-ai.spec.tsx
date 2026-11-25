import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { clearAiFills, sendAiFill } from "@/features/seo/advisor/ai-fill"
import { ListingDescriptionCard } from "./listing-description-card"
import type { ListingKind } from "./listing-description-card"

const sdkFetch = vi.hoisted(() => vi.fn())
const netFetch = vi.fn()

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true, useStaff: () => undefined }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))
// ProseMirror cannot lay out in jsdom: the document shown as JSON
vi.mock("@/features/content/editor/rich-editor", () => ({
  RichEditor: (props: { value: JSONContent; label: string }) => (
    <output aria-label={props.label}>{JSON.stringify(props.value)}</output>
  ),
}))

const task = (id: string, allowed = true) => ({
  id,
  capability: "text",
  mode: "sync",
  options: ["short", "detailed"],
  allowed,
  usable: ["deepseek"],
  preference: null,
})

const TEXT = "Bu markanın ürünleri üç grupta toplanıyor.\nSeçerken hacme bakın."
const PARAGRAPHS: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Bu markanın ürünleri üç grupta toplanıyor." }],
    },
    { type: "paragraph", content: [{ type: "text", text: "Seçerken hacme bakın." }] },
  ],
}

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const save = vi.fn(() => Promise.resolve())

function setup(kind: ListingKind, id: string, tasks: unknown[]) {
  sdkFetch.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/ai/services" ? { services: [], tasks, flags: { own_keys: true } } : {}
    )
  )
  netFetch.mockImplementation((url: string) =>
    url.endsWith("/accept")
      ? json(200, { suggestion: { id: "sug_1", text: TEXT } })
      : json(201, {
          suggestion: {
            id: "sug_1",
            task: `${kind}_description`,
            service: "deepseek",
            status: "draft",
            text: TEXT,
            candidates: [TEXT],
            problems: [],
            alternatives: [],
          },
        })
  )
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ListingDescriptionCard
        kind={kind}
        id={id}
        doc={null}
        text="Eski metin."
        saving={false}
        save={save}
      />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

const shown = async () =>
  JSON.parse((await screen.findByLabelText("Açıklama")).textContent) as JSONContent
const bodyOf = (index: number) =>
  JSON.parse((netFetch.mock.calls[index]?.[1] as { body: string }).body) as Record<string, unknown>
const NAME = "Açıklama için yapay zekâ ile öner"

beforeEach(() => {
  sdkFetch.mockReset()
  netFetch.mockReset()
  save.mockClear()
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearAiFills("brand", "brand_1")
  clearAiFills("collection", "pcol_1")
})

describe("ListingDescriptionCard's AI button (adr/0074 §5 madde 1)", () => {
  it.each([
    ["category", "pcat_1"],
    ["collection", "pcol_1"],
    ["brand", "brand_1"],
  ] as const)(
    "asks the %s's own description and puts it in as plain paragraphs, unsaved",
    async (kind, id) => {
      const user = setup(kind, id, [task(`${kind}_description`)])
      await user.click(await screen.findByRole("button", { name: NAME }))
      await screen.findByText(/Bu markanın ürünleri/)
      expect(bodyOf(0)).toEqual({ task: `${kind}_description`, entity_type: kind, entity_id: id })
      await user.click(screen.getByRole("button", { name: "Kullan" }))
      await waitFor(async () => {
        expect(await shown()).toEqual(PARAGRAPHS)
      })
      expect(save).not.toHaveBeenCalled()
      expect(netFetch.mock.calls.map(([url]) => String(url))).toEqual([
        "/admin/ai/suggestions",
        "/admin/ai/suggestions/sug_1/accept",
      ])
    }
  )

  it("offers Kısa and Ayrıntılı only, and a red Vazgeç that dismisses", async () => {
    const user = setup("brand", "brand_1", [task("brand_description")])
    await user.click(await screen.findByRole("button", { name: NAME }))
    const lengths = await screen.findByRole("radiogroup", { name: "Seçenek" })
    expect(
      within(lengths)
        .getAllByRole("radio")
        .map((each) => each.textContent)
    ).toEqual(["Kısa", "Ayrıntılı"])
    await screen.findByText(/Bu markanın ürünleri/)
    const cancel = screen.getByRole("button", { name: "Vazgeç" })
    expect(cancel.className).toMatch(/destructive|red/)
    await user.click(cancel)
    await waitFor(() => {
      expect(netFetch.mock.calls.map(([url]) => String(url))).toContain(
        "/admin/ai/suggestions/sug_1/dismiss"
      )
    })
    expect(await shown()).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Eski metin." }] }],
    })
  })

  it("takes an advisor finding's suggestion (K-CONT-01) for its own record only", async () => {
    sendAiFill("collection", "pcol_1", "description", TEXT)
    setup("collection", "pcol_1", [task("collection_description")])
    await waitFor(async () => {
      expect(await shown()).toEqual(PARAGRAPHS)
    })
    expect(netFetch).not.toHaveBeenCalled()
  })

  it("draws no button for a role the task does not allow", async () => {
    setup("brand", "brand_1", [task("brand_description", false)])
    await shown()
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/services")
    })
    expect(screen.queryByRole("button", { name: NAME })).toBeNull()
  })
})
