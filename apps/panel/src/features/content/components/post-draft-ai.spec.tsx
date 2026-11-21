import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ContentDetail } from "@/features/content/api/content"
import { ContentBodyCard } from "./content-body-card"

const sdkFetch = vi.hoisted(() => vi.fn())
const mutateAsync = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const netFetch = vi.fn()

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("sonner", () => ({ toast }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock("@/features/content/api/content", () => ({
  contentQuery: (id: string) => ({ queryKey: ["content", id] }),
  useUpdateContent: () => ({ isPending: false, mutateAsync }),
}))
// ProseMirror cannot lay out in jsdom: the document shown as JSON
vi.mock("@/features/content/editor/rich-editor", () => ({
  RichEditor: (props: { value: JSONContent; label: string }) => (
    <output aria-label={props.label}>{JSON.stringify(props.value)}</output>
  ),
}))

/**
 * "Taslak yaz" on a blog post's editor (adr/0074 §5 madde 5): the draft is
 * previewed, "Kullan" puts it in as headings and paragraphs (plain text
 * nodes, never HTML) as an unsaved change, the links stay in a list apart.
 * A post with text asks before the draft replaces it; Vazgeç is red.
 */

const task = (allowed = true) => ({
  id: "post_draft",
  capability: "text",
  mode: "sync",
  options: ["short", "detailed"],
  allowed,
  usable: ["deepseek"],
  preference: null,
})

const DRAFT = {
  sections: [
    { heading: "", level: 2, paragraphs: ["Termos ılık suyla temizlenir."] },
    { heading: "Koku nasıl gider?", level: 2, paragraphs: ["<b>Karbonat</b> kullanın."] },
    { heading: "Conta", level: 3, paragraphs: ["Contayı ayrıca yıkayın."] },
  ],
  links: [
    {
      code: "k1",
      kind: "category",
      id: "pcat_1",
      name: "Termoslar",
      path: "/kategori/termoslar",
      why: "Girişte",
    },
    { code: "u1", kind: "product", id: "prod_1", name: "Kötü", path: "//evil.example", why: "x" },
  ],
  words: 640,
  dropped_links: 0,
}

const EXPECTED: JSONContent = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Termos ılık suyla temizlenir." }] },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Koku nasıl gider?" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "<b>Karbonat</b> kullanın." }] },
    { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Conta" }] },
    { type: "paragraph", content: [{ type: "text", text: "Contayı ayrıca yıkayın." }] },
  ],
}

const EMPTY_BODY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] }
const OLD_BODY: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Eski metin." }] }],
}

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

function setup(body: JSONContent, tasks: unknown[] = [task()], kind: "post" | "page" = "post") {
  sdkFetch.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/ai/services" ? { services: [], tasks, flags: { own_keys: true } } : {}
    )
  )
  netFetch.mockImplementation((url: string) =>
    url.endsWith("/accept") || url.endsWith("/dismiss")
      ? json(200, { suggestion: { id: "sug_1", text: JSON.stringify(DRAFT) } })
      : json(201, {
          suggestion: {
            id: "sug_1",
            task: "post_draft",
            service: "deepseek",
            status: "draft",
            text: JSON.stringify(DRAFT),
            candidates: [JSON.stringify(DRAFT)],
            draft: DRAFT,
            problems: [],
            alternatives: [],
          },
        })
  )
  const entry = { id: "cnt_1", kind, body } as unknown as ContentDetail
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ContentBodyCard entry={entry} />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

const shown = async () =>
  JSON.parse((await screen.findByLabelText("Metin")).textContent) as JSONContent
const urls = () => netFetch.mock.calls.map(([url]) => String(url))
const BUTTON = "Taslak yaz"

beforeEach(() => {
  sdkFetch.mockReset()
  netFetch.mockReset()
  mutateAsync.mockReset()
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("a blog post's draft (adr/0074 §5 madde 5)", () => {
  it("previews the draft and puts it in as headings and plain paragraphs, unsaved", async () => {
    const user = setup(EMPTY_BODY)
    const button = await screen.findByRole("button", { name: BUTTON })
    await user.click(button)
    const dialog = await screen.findByRole("dialog")
    await within(dialog).findByRole("heading", { name: "Koku nasıl gider?" })
    // Markup a text holds is shown as text, never drawn
    expect(within(dialog).getByText("<b>Karbonat</b> kullanın.")).toBeInTheDocument()
    const asked = JSON.parse((netFetch.mock.calls[0]?.[1] as { body: string }).body) as unknown
    expect(asked).toEqual({ task: "post_draft", entity_type: "post", entity_id: "cnt_1" })
    await user.click(within(dialog).getByRole("button", { name: "Kullan" }))
    await waitFor(async () => {
      expect(await shown()).toEqual(EXPECTED)
    })
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(urls()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/accept"])
    // The links apart, a path off the shop dropped
    const list = await screen.findByRole("list")
    expect(within(list).getAllByRole("listitem")).toHaveLength(1)
    expect(within(list).getByText("/kategori/termoslar")).toBeInTheDocument()
  })

  it("copies a suggested link's path", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    const user = setup(EMPTY_BODY)
    // After userEvent's own stand-in, which it puts in place on setup
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    await user.click(await screen.findByRole("button", { name: BUTTON }))
    const dialog = await screen.findByRole("dialog")
    await within(dialog).findByRole("heading", { name: "Koku nasıl gider?" })
    await user.click(within(dialog).getByRole("button", { name: "Kullan" }))
    await user.click(await screen.findByRole("button", { name: "Termoslar bağlantısını kopyala" }))
    expect(writeText).toHaveBeenCalledWith("/kategori/termoslar")
  })

  it("asks before a draft replaces the post's text, and a red Vazgeç dismisses", async () => {
    const user = setup(OLD_BODY)
    await user.click(await screen.findByRole("button", { name: BUTTON }))
    let dialog = await screen.findByRole("dialog")
    await within(dialog).findByRole("heading", { name: "Koku nasıl gider?" })
    await user.click(within(dialog).getByRole("button", { name: "Kullan" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/yerine geçer/)
    expect(await shown()).toEqual(OLD_BODY)
    await user.click(within(dialog).getByRole("button", { name: "Geri" }))
    const cancel = within(dialog).getByRole("button", { name: "Vazgeç" })
    expect(cancel.className).toMatch(/destructive|red/)
    await user.click(cancel)
    await waitFor(() => {
      expect(urls()).toContain("/admin/ai/suggestions/sug_1/dismiss")
    })
    expect(await shown()).toEqual(OLD_BODY)

    await user.click(screen.getByRole("button", { name: BUTTON }))
    dialog = await screen.findByRole("dialog")
    await within(dialog).findByRole("heading", { name: "Koku nasıl gider?" })
    await user.click(within(dialog).getByRole("button", { name: "Kullan" }))
    await user.click(await within(dialog).findByRole("button", { name: "Yeni taslakla değiştir" }))
    await waitFor(async () => {
      expect(await shown()).toEqual(EXPECTED)
    })
  })

  it("draws no button for a role the task does not allow", async () => {
    setup(EMPTY_BODY, [task(false)])
    await shown()
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/services")
    })
    expect(screen.queryByRole("button", { name: BUTTON })).toBeNull()
  })

  it("draws no button on a content page", async () => {
    setup(EMPTY_BODY, [task()], "page")
    await shown()
    expect(screen.queryByRole("button", { name: BUTTON })).toBeNull()
  })
})
