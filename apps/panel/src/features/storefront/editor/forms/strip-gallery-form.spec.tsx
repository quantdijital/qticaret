import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { STRIP_GALLERY_DEFAULTS } from "@qticaret/types"
import "@/lib/i18n"
import type { StripGallerySection, StripItem } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { StripGalleryForm } from "./strip-gallery-form"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// A record's name is its kind and id: no catalogue to read in a test
vi.mock("./record-names", () => ({
  useRecordNames: (kind: string, ids: readonly string[]) => ({
    data: Object.fromEntries(ids.map((id) => [id, `${kind} ${id}`])),
    isPending: false,
  }),
  useLinkName: () => null,
}))

const ID = "seritler01"

const product = (target: string, over: Partial<StripItem> = {}): StripItem => ({
  source: { kind: "product", target },
  image: null,
  title: null,
  note: null,
  link: null,
  ...over,
})
const custom = (title: string): StripItem => ({
  source: { kind: "custom" },
  image: { url: `/static/${title}.webp`, alt: null },
  title,
  note: null,
  link: null,
})

const gallery = (items: StripItem[]): StripGallerySection => ({
  ...(newHomeSection("strip_gallery", ID) as StripGallerySection),
  items,
})

/** The form as the editor holds it: every change kept, its problems found again. */
function renderForm(section: StripGallerySection) {
  const changes: StripGallerySection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <StripGalleryForm
        section={value}
        problems={sectionProblems(value)}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Holder />
    </QueryClientProvider>
  )
  return { last: () => changes.at(-1) }
}

const rows = () => within(screen.getByRole("list", { name: "Şeritler" })).getAllByRole("listitem")

describe("the strip gallery's form (adr/0049 Ek 2026-11-16)", () => {
  it("starts with no strip and the contract's settings, saying two are needed", () => {
    const section = newHomeSection("strip_gallery", ID)
    expect(section).toEqual({
      id: ID,
      visible: true,
      starts_at: null,
      ends_at: null,
      type: "strip_gallery",
      title: null,
      text: null,
      items: [],
      ...STRIP_GALLERY_DEFAULTS,
    })
    renderForm(section as StripGallerySection)
    expect(screen.getByRole("textbox", { name: "Başlık" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "Metin" })).toBeVisible()
    expect(screen.getByText(/Henüz şerit yok/)).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent("En az iki şerit ekleyin.")
  })

  it("lists each strip with its heading or its record's name, moves and removes them", async () => {
    const user = userEvent.setup()
    const form = renderForm(gallery([product("p1"), custom("Kamp"), product("p2")]))
    expect(rows()).toHaveLength(3)
    expect(rows()[0]).toHaveTextContent("1. şerit · Ürün")
    expect(rows()[0]).toHaveTextContent("product p1")
    expect(rows()[1]).toHaveTextContent("Serbest görsel")
    expect(rows()[1]).toHaveTextContent("Kamp")

    await user.click(screen.getByRole("button", { name: /2\. şerit.*yukarı/i }))
    expect(form.last()?.items.map((each) => each.title)).toEqual(["Kamp", null, null])
    await user.click(screen.getByRole("button", { name: /3\. şerit.*kaldır/i }))
    expect(form.last()?.items).toHaveLength(2)
    await user.click(screen.getByRole("button", { name: /2\. şerit.*kaldır/i }))
    expect(screen.getByRole("alert")).toHaveTextContent("En az iki şerit ekleyin.")
  })

  it("adds a product strip and opens it; at eight the add button closes and says why", async () => {
    const user = userEvent.setup()
    const seven = Array.from({ length: 7 }, (_, at) => product(`p${String(at)}`))
    const form = renderForm(gallery(seven))
    await user.click(screen.getByRole("button", { name: "Şerit ekle" }))
    expect(form.last()?.items).toHaveLength(8)
    expect(form.last()?.items[7]).toEqual(product(""))
    const dialog = await screen.findByRole("dialog", { name: "Şeridi düzenle" })
    expect(within(dialog).getByText("Bir ürün seçin.")).toBeVisible()
    await user.keyboard("{Escape}")
    expect(screen.getByRole("button", { name: "Şerit ekle" })).toBeDisabled()
    expect(screen.getByText("En çok 8 şerit eklenebilir.")).toBeVisible()
  })

  it("keeps the shop's own words when the source changes, and drops the record for its own picture", async () => {
    const user = userEvent.setup()
    const form = renderForm(
      gallery([product("p1", { title: "Bizim bıçak", note: "Yeni" }), custom("Kamp")])
    )
    await user.click(screen.getByRole("button", { name: "1. şerit: düzenle" }))
    const dialog = await screen.findByRole("dialog", { name: "Şeridi düzenle" })
    // Every free field stands whatever the source
    expect(within(dialog).getByRole("textbox", { name: "Başlık" })).toHaveValue("Bizim bıçak")
    expect(within(dialog).getByText("Boş bırakırsanız ürünün fiyatı yazar.")).toBeVisible()
    expect(within(dialog).getByText("Boş bırakırsanız ürün sayfası açılır.")).toBeVisible()

    await user.click(within(dialog).getByRole("radio", { name: "Kategori" }))
    expect(within(dialog).getByText("Bir kategori seçin.")).toBeVisible()
    expect(
      within(dialog).getByText("Boş bırakırsanız kategorideki ürün sayısı yazar.")
    ).toBeVisible()
    await user.click(within(dialog).getByRole("radio", { name: "Serbest görsel" }))
    expect(within(dialog).getByRole("textbox", { name: "Başlık" })).toHaveValue("Bizim bıçak")
    expect(within(dialog).getByRole("textbox", { name: "Alt satır" })).toHaveValue("Yeni")
    // Its own picture is the only one it has
    expect(within(dialog).getByText("Bir görsel seçin.")).toBeVisible()
    // Back to a product: its record is chosen anew, the save waits for it
    await user.click(within(dialog).getByRole("radio", { name: "Ürün" }))
    expect(within(dialog).getByText("Bir ürün seçin.")).toBeVisible()
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    expect(form.last()).toBeUndefined()
    expect(screen.getByRole("dialog", { name: "Şeridi düzenle" })).toBeVisible()
  })

  it("puts a strip's own line into the draft on Kaydet", async () => {
    const user = userEvent.setup()
    const form = renderForm(gallery([product("p1"), custom("Kamp")]))
    await user.click(screen.getByRole("button", { name: "2. şerit: düzenle" }))
    const dialog = await screen.findByRole("dialog", { name: "Şeridi düzenle" })
    await user.type(within(dialog).getByRole("textbox", { name: "Alt satır" }), "Yeni sezon")
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    expect(form.last()?.items[1]).toEqual({ ...custom("Kamp"), note: "Yeni sezon" })
  })

  it("shows the record's name as the heading's placeholder", async () => {
    const user = userEvent.setup()
    renderForm(gallery([product("p1"), custom("Kamp")]))
    await user.click(screen.getByRole("button", { name: "1. şerit: düzenle" }))
    const dialog = await screen.findByRole("dialog", { name: "Şeridi düzenle" })
    expect(within(dialog).getByRole("textbox", { name: "Başlık" })).toHaveAttribute(
      "placeholder",
      "Boşsa: product p1"
    )
  })
})
