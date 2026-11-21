import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { ProductShortDescriptionCard } from "./short-description-card"

const sdkFetch = vi.hoisted(() => vi.fn())
const netFetch = vi.fn()

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
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

const PRODUCT = { id: "prod_1", title: "Keten Gömlek" } as unknown as ProductDetail

const CATALOG = {
  condition: "new",
  kind: "physical",
  primary_category_id: null,
  withdrawal_excluded: false,
  restriction: null,
  is_gift_card: false,
  addons: [],
  description_doc: null,
  summary_doc: null,
  successor: null,
  categories: [],
  variants: [],
} satisfies ProductCatalog

const CANDIDATES = [
  "Yazlık keten gömlek, sıcak günlerde serin tutar.",
  "Nefes alan keten gömlek. Rahat kesim.",
  "Hafif keten gömlek.",
]

const task = (allowed = true) => ({
  id: "short_description",
  capability: "text",
  mode: "sync",
  options: [],
  allowed,
  usable: ["deepseek"],
  preference: null,
})

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

function setup(allowed = true) {
  sdkFetch.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/ai/services"
        ? { services: [], tasks: [task(allowed)], flags: { own_keys: true } }
        : CATALOG
    )
  )
  netFetch.mockImplementation((url: string) =>
    url.endsWith("/accept")
      ? json(200, { suggestion: { id: "sug_1", text: CANDIDATES[1] } })
      : json(201, {
          suggestion: {
            id: "sug_1",
            task: "short_description",
            service: "deepseek",
            status: "draft",
            text: CANDIDATES[0],
            candidates: CANDIDATES,
            problems: [],
            alternatives: [],
          },
        })
  )
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProductShortDescriptionCard product={PRODUCT} />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

const NAME = "Kısa açıklama için yapay zekâ ile öner"
const shown = async () =>
  JSON.parse((await screen.findByLabelText("Kısa açıklama")).textContent) as JSONContent

beforeEach(() => {
  sdkFetch.mockReset()
  netFetch.mockReset()
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ProductShortDescriptionCard's AI button (adr/0074 §5 madde 2)", () => {
  it("offers three candidates and puts the one taken in as a paragraph, nothing saved", async () => {
    const user = setup()
    await shown()
    await user.click(await screen.findByRole("button", { name: NAME }))
    await user.click(await screen.findByRole("radio", { name: new RegExp(CANDIDATES[1] ?? "") }))
    await user.click(screen.getByRole("button", { name: "Kullan" }))

    await waitFor(async () => {
      expect(await shown()).toEqual({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: CANDIDATES[1] }] }],
      })
    })
    expect(netFetch.mock.calls.map(([url]) => String(url))).toEqual([
      "/admin/ai/suggestions",
      "/admin/ai/suggestions/sug_1/accept",
    ])
    expect(JSON.parse((netFetch.mock.calls[0]?.[1] as { body: string }).body) as unknown).toEqual({
      task: "short_description",
      entity_type: "product",
      entity_id: "prod_1",
    })
  })

  it("draws no button for a role the task does not allow", async () => {
    setup(false)
    await shown()
    expect(screen.queryByRole("button", { name: NAME })).not.toBeInTheDocument()
  })
})
