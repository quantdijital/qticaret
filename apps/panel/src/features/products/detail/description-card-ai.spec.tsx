import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { ProductDescriptionCard } from "./description-card"

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

const PRODUCT = {
  id: "prod_1",
  title: "Keten Gömlek",
  handle: "keten-gomlek",
  description: "Yazlık keten.",
} as unknown as ProductDetail

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

const task = (usable: string[], allowed = true) => ({
  id: "product_description",
  capability: "text",
  mode: "sync",
  options: ["short", "detailed"],
  allowed,
  usable,
  preference: null,
})

// The core's text: paragraphs apart by one line break (docs/22 PR 2-1)
const TEXT = "Keten gömlek yazın serin tutar.\nİki renkte, rahat kesim."

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

function setup(tasks: unknown[]) {
  sdkFetch.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/ai/services" ? { services: [], tasks, flags: { own_keys: true } } : CATALOG
    )
  )
  netFetch.mockImplementation((url: string) =>
    url.endsWith("/accept")
      ? json(200, { suggestion: { id: "sug_1", text: TEXT } })
      : json(201, {
          suggestion: {
            id: "sug_1",
            task: "product_description",
            service: "deepseek",
            status: "draft",
            text: TEXT,
            problems: [],
            alternatives: [],
          },
        })
  )
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProductDescriptionCard product={PRODUCT} />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

const shown = async () =>
  JSON.parse((await screen.findByLabelText("Açıklama")).textContent) as JSONContent
const saveShown = () =>
  !screen.getByRole("button", { name: "Kaydet" }).parentElement?.classList.contains("hidden")
const bodyOf = (index: number) =>
  JSON.parse((netFetch.mock.calls[index]?.[1] as { body: string }).body) as Record<string, unknown>
const NAME = "Açıklama için yapay zekâ ile öner"

beforeEach(() => {
  sdkFetch.mockReset()
  netFetch.mockReset()
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ProductDescriptionCard's AI button (adr/0071 §13, docs/22 PR 2-2)", () => {
  it("puts the suggestion in as plain paragraphs, a change nothing saves until Kaydet", async () => {
    const user = setup([task(["deepseek"])])
    await shown()
    expect(saveShown()).toBe(false)

    await user.click(await screen.findByRole("button", { name: NAME }))
    await screen.findByText(/Keten gömlek yazın serin tutar/)
    expect(bodyOf(0)).toEqual({
      task: "product_description",
      entity_type: "product",
      entity_id: "prod_1",
    })
    await user.click(screen.getByRole("button", { name: "Kullan" }))

    await waitFor(async () => {
      expect(await shown()).toEqual({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Keten gömlek yazın serin tutar." }],
          },
          { type: "paragraph", content: [{ type: "text", text: "İki renkte, rahat kesim." }] },
        ],
      })
    })
    expect(saveShown()).toBe(true)
    // Only the suggestion and its decision went out; the product was not written
    expect(netFetch.mock.calls.map(([url]) => String(url))).toEqual([
      "/admin/ai/suggestions",
      "/admin/ai/suggestions/sug_1/accept",
    ])
    expect(
      sdkFetch.mock.calls.some(([, init]) => (init as { method?: string } | undefined)?.method)
    ).toBe(false)

    // Undo drops it: back to the stored text
    await user.click(screen.getByRole("button", { name: "Geri al" }))
    expect(await shown()).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Yazlık keten." }] }],
    })
  })

  it("offers the ready lengths only, Kısa and Ayrıntılı, and asks again with the one picked", async () => {
    const user = setup([task(["deepseek"])])
    await user.click(await screen.findByRole("button", { name: NAME }))
    const lengths = await screen.findByRole("radiogroup", { name: "Seçenek" })
    expect(
      within(lengths)
        .getAllByRole("radio")
        .map((each) => each.textContent)
    ).toEqual(["Kısa", "Ayrıntılı"])
    expect(screen.queryByRole("textbox")).toBeNull()
    await user.click(within(lengths).getByRole("radio", { name: "Ayrıntılı" }))
    await waitFor(() => {
      expect(netFetch).toHaveBeenCalledTimes(2)
    })
    expect(bodyOf(1)["option"]).toBe("detailed")
  })

  it("draws nothing for a role the task does not allow", async () => {
    setup([task(["deepseek"], false)])
    await shown()
    expect(screen.queryByRole("button", { name: NAME })).toBeNull()
  })
})
