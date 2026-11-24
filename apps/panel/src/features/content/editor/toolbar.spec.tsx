import { render, screen } from "@testing-library/react"
import { Editor } from "@tiptap/react"
import { afterEach, describe, expect, it } from "vitest"
import "@/lib/i18n"
import { TooltipProvider } from "@qticaret/admin-ui/ui/tooltip"
import { contentExtensions } from "./extensions"
import { Toolbar } from "./toolbar"

const editors: Editor[] = []

function renderToolbar(media: boolean, short = false) {
  const editor = new Editor({ extensions: contentExtensions("", { media, short }) })
  editors.push(editor)
  render(
    <TooltipProvider>
      <Toolbar
        editor={editor}
        media={media}
        short={short}
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

  // ADR-0055 Ek 2026-11-06: a product's short description, above the price
  it("keeps a short text to paragraphs, h3–h4, lists, bold, italic and links", () => {
    const editor = renderToolbar(false, true)
    for (const tool of ["Kalın", "İtalik", "Bağlantı", "Madde listesi", "Numaralı liste"]) {
      expect(has(tool)).toBe(true)
    }
    for (const tool of ["Alıntı", "Tablo ekle", "Görsel ekle", "Ürün kartı ekle"]) {
      expect(has(tool)).toBe(false)
    }
    expect(editor.schema.nodes["blockquote"]).toBeUndefined()
    expect(editor.schema.nodes["table"]).toBeUndefined()
    expect(editor.schema.nodes["hardBreak"]).toBeDefined()
    // A pasted h2 comes in as a paragraph; links to the shop or https only
    editor.commands.setContent("<h2>Başlık</h2><h3>Alt</h3><p><a href='http://a.com'>eski</a></p>")
    const json = editor.getJSON()
    expect(json.content.map((node) => node.type)).toEqual(["paragraph", "heading", "paragraph"])
    expect(JSON.stringify(json)).not.toContain("http://a.com")
  })

  // On a page it sticks under the app header; a dialog body scrolls on its own, so there
  // a sticky bar would float over the text (jsdom has no CSS: the classes are the contract)
  it("sticks under the header on a page and stays in place inside a dialog", () => {
    renderToolbar(true)
    const bar = screen.getByRole("button", { name: "Kalın" }).closest(".sticky")
    expect(bar).not.toBeNull()
    expect(bar?.className).toContain("top-14")
    expect(bar?.className).toContain("[[role=dialog]_&]:static")
  })
})
