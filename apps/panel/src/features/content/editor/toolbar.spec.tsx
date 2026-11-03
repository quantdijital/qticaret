import { render, screen } from "@testing-library/react"
import { Editor } from "@tiptap/react"
import { afterEach, describe, expect, it } from "vitest"
import "@/lib/i18n"
import { TooltipProvider } from "@/components/ui/tooltip"
import { contentExtensions } from "./extensions"
import { Toolbar } from "./toolbar"

const editors: Editor[] = []

function renderToolbar(media: boolean) {
  const editor = new Editor({ extensions: contentExtensions("", { media }) })
  editors.push(editor)
  render(
    <TooltipProvider>
      <Toolbar
        editor={editor}
        media={media}
        onLink={() => undefined}
        onImage={() => undefined}
        onCard={() => undefined}
      />
    </TooltipProvider>
  )
  return editor
}

const has = (name: string) => screen.queryByRole("button", { name }) !== null

describe("Toolbar: the tools a text takes", () => {
  afterEach(() => {
    editors.splice(0).forEach((editor) => {
      editor.destroy()
    })
  })

  it("offers pictures and cards for pages and posts", () => {
    renderToolbar(true)
    expect(has("Görsel ekle")).toBe(true)
    expect(has("Ürün kartı ekle")).toBe(true)
    expect(has("Kategori kartı ekle")).toBe(true)
    expect(has("Tablo ekle")).toBe(true)
  })

  // ADR-0055: a product's description keeps headings, lists, quotes, tables and links only
  it("leaves pictures and cards out of a product's description, tables and lists kept", () => {
    const editor = renderToolbar(false)
    expect(has("Görsel ekle")).toBe(false)
    expect(has("Ürün kartı ekle")).toBe(false)
    expect(has("Kategori kartı ekle")).toBe(false)
    for (const tool of ["Tablo ekle", "Madde listesi", "Numaralı liste", "Alıntı", "Bağlantı"]) {
      expect(has(tool)).toBe(true)
    }
    // Nor does its schema know them: a stored picture or card could not come back in
    expect(editor.schema.nodes["image"]).toBeUndefined()
    expect(editor.schema.nodes["productCard"]).toBeUndefined()
    expect(editor.schema.nodes["table"]).toBeDefined()
  })
})
