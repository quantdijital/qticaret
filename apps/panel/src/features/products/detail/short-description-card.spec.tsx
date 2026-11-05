import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { ProductShortDescriptionCard } from "./short-description-card"

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
    short?: boolean
    maxChars?: number
    placeholder?: string
  }) => {
    editorProps({
      media: props.media,
      shopTokens: props.shopTokens,
      short: props.short,
      maxChars: props.maxChars,
      placeholder: props.placeholder,
    })
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

const PRODUCT = { id: "prod_1", title: "Keten Gömlek" } as unknown as ProductDetail

const DOC: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Yıkanmış " },
        { type: "text", text: "keten", marks: [{ type: "bold" }] },
        { type: "text", text: ", rahat kesim." },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Sedef düğme" }] }],
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
    description_doc: null,
    summary_doc: doc,
    successor: null,
    categories: [],
    variants: [],
  }) satisfies ProductCatalog

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProductShortDescriptionCard product={PRODUCT} />
    </QueryClientProvider>
  )
}

const shown = async () =>
  JSON.parse((await screen.findByLabelText("Kısa açıklama")).textContent) as JSONContent

const saveShown = () =>
  !screen.getByRole("button", { name: "Kaydet" }).parentElement?.classList.contains("hidden")

describe("ProductShortDescriptionCard (ADR-0055 Ek 2026-11-06)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    editorProps.mockReset()
    typed.doc = null
  })

  it("opens the stored text in the description's editor, short, counting characters", async () => {
    fetchMock.mockResolvedValue(catalogOf(DOC))
    renderCard()
    expect(await shown()).toEqual(DOC)
    expect(editorProps).toHaveBeenLastCalledWith({
      media: false,
      shopTokens: false,
      short: true,
      maxChars: 1500,
      placeholder: "Örn. Ürünü birkaç cümleyle tanıtın: malzeme, ölçü, kullanım.",
    })
    expect(screen.getByText(/yazdığınız gibi görünür/)).toBeDefined()
    expect(saveShown()).toBe(false)
  })

  it("opens empty without one; the editor's empty paragraph is no change", async () => {
    fetchMock.mockResolvedValue(catalogOf(null))
    renderCard()
    expect(await shown()).toEqual({ type: "doc", content: [] })
    typed.doc = { type: "doc", content: [{ type: "paragraph" }] }
    await userEvent.click(screen.getByRole("button", { name: "edit" }))
    expect(saveShown()).toBe(false)
  })

  it("saves the whole text through the catalog fields and shows the saved one", async () => {
    fetchMock.mockImplementation((_url: string, init?: { body?: { summary_doc?: unknown } }) =>
      Promise.resolve(catalogOf((init?.body?.summary_doc as JSONContent | undefined) ?? null))
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
        body: { summary_doc: DOC },
      })
    })
    await waitFor(() => {
      expect(saveShown()).toBe(false)
    })
    expect(await shown()).toEqual(DOC)
  })
})
