import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { i18next } from "@/lib/i18n"
import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import type { AttributeDefinition, AttributeTemplate } from "@/features/attributes/types"
import { NO_FLAGS } from "@/features/storefront/layout/sections"
import { searchTheme } from "./settings-search"
import { SectionFlagsContext } from "./section-flags"
import { SearchFormGroup } from "./theme-search-form-fields"
import { whereAttributes } from "./forms/theme-registry-search"

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

/**
 * adr/0077 §1: the search box's fields in the theme panel. The "where"
 * field offers the filterable choice attributes, the dates and the party
 * only while the shop sells dated products, the categories' look only
 * while they are shown.
 */

const THEME: ThemeSettings = { ...GRAFIT_THEME, settings_version: 2, theme: "atolye" }
const t = (key: string) => i18next.t(key)

const definition = (key: string, more: Partial<AttributeDefinition> = {}): AttributeDefinition => ({
  id: key,
  key,
  label: key.toUpperCase(),
  type: "select",
  unit: null,
  options: [],
  rank: 0,
  is_required: false,
  is_filterable: true,
  is_seo_highlight: false,
  scope: "product",
  option_title: null,
  varies_by: null,
  ...more,
})

const TEMPLATES: AttributeTemplate[] = [
  {
    id: "tur",
    name: "Tur",
    handle: "tur",
    description: null,
    definitions: [
      definition("bolge", { label: "Bölge" }),
      definition("sure", { type: "number" }),
      definition("not", { is_public: false }),
      definition("rehber", { is_filterable: false }),
      definition("kisi"),
      definition("tema", { type: "multi_select", label: "Tema" }),
    ],
  },
  { id: "b", name: "B", handle: "b", description: null, definitions: [definition("bolge")] },
]

function draw(theme = THEME, flags: readonly string[] = []) {
  const onChange = vi.fn<(theme: ThemeSettings) => void>()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SectionFlagsContext.Provider value={{ ...NO_FLAGS, on: new Set(flags) }}>
        <SearchFormGroup theme={theme} reveal={1} onChange={onChange} />
      </SectionFlagsContext.Provider>
    </QueryClientProvider>
  )
  return onChange
}

const withForm = (form: Partial<ThemeSettings["search_form"]>): ThemeSettings => ({
  ...THEME,
  search_form: { ...THEME.search_form, ...form },
})

describe("the attributes a 'where' field can use", () => {
  it("keeps the filterable, public choice attributes, each once, never a reserved name", () => {
    expect([...whereAttributes(TEMPLATES)]).toEqual([
      ["bolge", "Bölge"],
      ["tema", "Tema"],
    ])
  })
})

describe("the theme panel's search box group", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ attribute_templates: TEMPLATES, count: 1 })
  })

  it("offers the where field and the categories, the dates and the party not without the flag", async () => {
    draw()
    expect(await screen.findByText("Nereye alanı")).toBeInTheDocument()
    expect(screen.getByLabelText("Kategori alanı")).toBeChecked()
    expect(screen.getByText("Kategoriler nasıl görünsün")).toBeInTheDocument()
    expect(screen.queryByLabelText("Tarih alanları")).toBeNull()
    expect(screen.queryByLabelText("Kişi alanı")).toBeNull()
  })

  it("offers the dates and the party while the shop sells dated products and saves them", () => {
    const onChange = draw(THEME, ["catalog.booking"])
    fireEvent.click(screen.getByLabelText("Tarih alanları"))
    expect(onChange).toHaveBeenLastCalledWith(withForm({ show_dates: false }))
    fireEvent.click(screen.getByLabelText("Kişi alanı"))
    expect(onChange).toHaveBeenLastCalledWith(withForm({ show_people: false }))
  })

  it("offers the flexible month and the date words with the dates, and saves them", () => {
    const onChange = draw(THEME, ["catalog.booking"])
    expect(screen.getByLabelText("Esnek ay alanı")).toBeChecked()
    fireEvent.click(screen.getByLabelText("Esnek ay alanı"))
    expect(onChange).toHaveBeenLastCalledWith(withForm({ flexible_month: false }))
    const words = screen.getByLabelText('Boş tarihte "Tarih ekle" yazsın')
    expect(words).not.toBeChecked()
    fireEvent.click(words)
    expect(onChange).toHaveBeenLastCalledWith(withForm({ date_words: true }))
  })

  it("hides the categories' look while the categories are off", () => {
    const onChange = draw(withForm({ show_category: false }))
    expect(screen.queryByText("Kategoriler nasıl görünsün")).toBeNull()
    fireEvent.click(screen.getByLabelText("Kategori alanı"))
    expect(onChange).toHaveBeenLastCalledWith(withForm({ show_category: true }))
  })

  it("names a chosen attribute by its label, and one gone by its own key", async () => {
    draw(withForm({ attribute_key: "bolge" }))
    expect(await screen.findByText("Bölge")).toBeInTheDocument()
  })

  it("keeps a key whose attribute went, by its own name", async () => {
    draw(withForm({ attribute_key: "eski_bolge" }))
    expect(await screen.findByText("eski_bolge")).toBeInTheDocument()
  })

  it("shows the word box when no attribute is named", () => {
    draw()
    const group = screen.getByText("Nereye alanı").closest("div")
    expect(
      within(group?.parentElement ?? document.body).getByText("Kelime kutusu (nitelik yok)")
    ).toBeInTheDocument()
  })

  it("saves the word box's hint as typed, and an empty one as none", () => {
    const onChange = draw(withForm({ placeholder: "Nereye" }))
    const field = screen.getByLabelText("Kelime kutusundaki ipucu")
    expect(field).toHaveValue("Nereye")
    fireEvent.change(field, { target: { value: "Nereye gitmek " } })
    expect(onChange).toHaveBeenLastCalledWith(withForm({ placeholder: "Nereye gitmek " }))
    fireEvent.change(field, { target: { value: "  " } })
    expect(onChange).toHaveBeenLastCalledWith(withForm({ placeholder: null }))
  })

  it("is found in the settings search, the dated two only with the flag", () => {
    const keys = (query: string, flags: readonly string[] = []) =>
      searchTheme(query, THEME, new Set(), t, new Set(flags)).map((hit) => hit.field.key)
    expect(keys("nereye")[0]).toBe("search_form.attribute_key")
    expect(keys("arama kutu")).toContain("search_form.show_category")
    expect(keys("tarih alanları")).not.toContain("search_form.show_dates")
    expect(keys("tarih alanları", ["catalog.booking"])).toContain("search_form.show_dates")
  })
})
