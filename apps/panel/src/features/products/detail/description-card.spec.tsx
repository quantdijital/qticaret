import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { ProductDescriptionCard } from "./description-card"

const fetchMock = vi.hoisted(() => vi.fn())
const editorProps = vi.hoisted(() => vi.fn())
// What a person "types": the document the stand-in editor gives on its edit button
const typed = vi.hoisted((): { doc: unknown } => ({ doc: null }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// ProseMirror cannot lay out in jsdom: the document shown as JSON, an edit given whole
vi.mock("@/features/content/editor/rich-editor", () => ({
  RichEditor: (props: {
    value: JSONContent
    onChange: (doc: JSONContent) => void
    label: string
    media?: boolean
    shopTokens?: boolean
  }) => {
    editorProps({ media: props.media, shopTokens: props.shopTokens })
    return (
      <div>
        <output aria-label={props.label}>{JSON.stringify(props.value)}</output>
        <button
          type="button"
          onClick={() => {
            props.onChange(typed.doc as JSONContent)
          }}
        >
          edit
        </button>
      </div>
    )
  },
}))

const PRODUCT = {
  id: "prod_1",
  title: "Keten Gömlek",
  handle: "keten-gomlek",
  description: "Yazlık keten.\n\nİki renk.",
} as unknown as ProductDetail

const DOC: JSONContent = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Özellikler" }] },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Kumaş" }] }],
            },
            {
              type: "tableCell",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Keten" }] }],
            },
          ],
        },
      ],
    },
  ],
}

const catalogOf = (doc: JSONContent | null) =>
  ({
    condition: "new",
    kind: "physical",
    primary_category_id: null,
    withdrawal_excluded: false,
    restriction: null,
    is_gift_card: false,
    addons: [],
    description_doc: doc,
    summary: [],
    successor: null,
    categories: [],
    variants: [],
  }) satisfies ProductCatalog

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProductDescriptionCard product={PRODUCT} />
    </QueryClientProvider>
  )
}

const shown = async () =>
  JSON.parse((await screen.findByLabelText("Açıklama")).textContent) as JSONContent

// The card's save and undo show once something changed (CardForm)
const saveShown = () =>
  !screen.getByRole("button", { name: "Kaydet" }).parentElement?.classList.contains("hidden")

describe("ProductDescriptionCard (ADR-0055)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    editorProps.mockReset()
    typed.doc = null
  })

  it("opens the stored document, in an editor without pictures, cards or shop details", async () => {
    fetchMock.mockResolvedValue(catalogOf(DOC))
    renderCard()
    expect(await shown()).toEqual(DOC)
    expect(editorProps).toHaveBeenLastCalledWith({ media: false, shopTokens: false })
    expect(saveShown()).toBe(false)
  })

  it("opens a product with plain text only as its paragraphs, unchanged until edited", async () => {
    fetchMock.mockResolvedValue(catalogOf(null))
    renderCard()
    expect(await shown()).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Yazlık keten." }] },
        { type: "paragraph", content: [{ type: "text", text: "İki renk." }] },
      ],
    })
    // The same paragraphs given back by the editor are no change
    typed.doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Yazlık keten." }] },
        { type: "paragraph", content: [{ type: "text", text: "İki renk." }] },
        { type: "paragraph" },
      ],
    }
    await userEvent.click(screen.getByRole("button", { name: "edit" }))
    expect(saveShown()).toBe(false)
  })

  it("saves the whole document through the catalog fields and shows the saved one", async () => {
    fetchMock.mockImplementation((_url: string, init?: { body?: { description_doc?: unknown } }) =>
      Promise.resolve(catalogOf((init?.body?.description_doc as JSONContent | undefined) ?? null))
    )
    renderCard()
    await shown()
    typed.doc = DOC
    await userEvent.click(screen.getByRole("button", { name: "edit" }))
    expect(saveShown()).toBe(true)
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
        method: "POST",
        body: { description_doc: DOC },
      })
    })
    await waitFor(() => {
      expect(saveShown()).toBe(false)
    })
    expect(await shown()).toEqual(DOC)
  })
})
