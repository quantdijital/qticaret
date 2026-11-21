import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { Brand } from "@/features/brands/api/brands"
import { BrandDescriptionCard } from "@/features/brands/components/brand-description-card"
import { CategoryDescriptionCard } from "@/features/categories/components/category-description-card"
import { collectionFixture } from "@/features/collections/collection-fixtures"
import { CollectionDescriptionCard } from "@/features/collections/components/collection-description-card"

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

const PLAIN = "Japon çelikleri.\n\nEl yapımı saplar."
const PARAGRAPHS: JSONContent = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Japon çelikleri." }] },
    { type: "paragraph", content: [{ type: "text", text: "El yapımı saplar." }] },
  ],
}
const DOC: JSONContent = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Çelikler" }] },
    { type: "paragraph", content: [{ type: "text", text: "VG-10 ve AUS-8." }] },
  ],
}

const BRAND: Brand = {
  id: "brand_1",
  name: "Ada",
  handle: "ada",
  description: PLAIN,
  description_doc: null,
  logo_file_id: null,
  logo_url: null,
  is_active: true,
  product_count: 0,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
}

function renderCard(card: ReactNode) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {card}
    </QueryClientProvider>
  )
}

const shown = async () =>
  JSON.parse((await screen.findByLabelText("Açıklama")).textContent) as JSONContent

// The card's save and undo show once something changed (CardForm)
const saveShown = () =>
  !screen.getByRole("button", { name: "Kaydet" }).parentElement?.classList.contains("hidden")

// The record's own route answers; the AI services offer nothing here (listing-description-card-ai.spec.tsx)
function respond(record: (url: string, init?: never) => Promise<unknown>) {
  fetchMock.mockImplementation((url: string, init?: never) =>
    url === "/admin/ai/services"
      ? Promise.resolve({ services: [], tasks: [], flags: { own_keys: true } })
      : record(url, init)
  )
}

async function editAndSave() {
  typed.doc = DOC
  await userEvent.click(screen.getByRole("button", { name: "edit" }))
  await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
}

describe("listing description cards (adr/0075)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    editorProps.mockReset()
    typed.doc = null
  })

  describe("category", () => {
    it("opens plain text as its paragraphs, in an editor without pictures or shop details", async () => {
      respond(() =>
        Promise.resolve({
          description: { category_id: "sef", description: PLAIN, description_doc: null },
        })
      )
      renderCard(<CategoryDescriptionCard categoryId="sef" />)

      expect(await shown()).toEqual(PARAGRAPHS)
      expect(fetchMock).toHaveBeenCalledWith("/admin/category-descriptions/sef")
      expect(editorProps).toHaveBeenLastCalledWith({ media: false, shopTokens: false })
      expect(screen.getByText(/sayfanın altında, ürünlerden sonra/)).toBeInTheDocument()
      expect(saveShown()).toBe(false)
    })

    it("writes the document through its own route only and shows the saved one", async () => {
      respond((_url: string, init?: { body?: { description_doc?: JSONContent | null } }) =>
        Promise.resolve({
          description: {
            category_id: "sef",
            description: PLAIN,
            description_doc: init?.body?.description_doc ?? null,
          },
        })
      )
      renderCard(<CategoryDescriptionCard categoryId="sef" />)
      await shown()
      await editAndSave()

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/admin/category-descriptions/sef", {
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

  describe("brand", () => {
    it("opens plain text as its paragraphs and saves the document only", async () => {
      respond((_url: string, init?: { body?: { description_doc?: JSONContent } }) =>
        Promise.resolve({ brand: { ...BRAND, description_doc: init?.body?.description_doc } })
      )
      renderCard(<BrandDescriptionCard brand={BRAND} />)

      expect(await shown()).toEqual(PARAGRAPHS)
      await editAndSave()

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/admin/brands/brand_1", {
          method: "POST",
          body: { description_doc: DOC },
        })
      })
    })

    it("opens a stored document as it is", async () => {
      renderCard(<BrandDescriptionCard brand={{ ...BRAND, description_doc: DOC }} />)
      expect(await shown()).toEqual(DOC)
    })
  })

  describe("collection", () => {
    it("opens plain text as its paragraphs and saves the document only", async () => {
      const collection = collectionFixture({ description: PLAIN })
      respond((_url: string, init?: { body?: { description_doc?: JSONContent } }) =>
        Promise.resolve({
          collection: { ...collection, description_doc: init?.body?.description_doc },
        })
      )
      renderCard(<CollectionDescriptionCard collection={collection} />)

      expect(await shown()).toEqual(PARAGRAPHS)
      await editAndSave()

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/admin/collections/pcol_1/details", {
          method: "POST",
          body: { description_doc: DOC },
        })
      })
    })
  })
})
