import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { HeroSection, PriceBandsSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { HOME_TYPES, newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import en from "@/locales/en.json"
import tr from "@/locales/tr.json"
import { HeroForm } from "./hero-form"
import { PriceBandsForm } from "./price-bands-form"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>)
}

/** A form as the editor holds it: every change kept, its problems found again. */
function holder<S extends HeroSection | PriceBandsSection>(
  Form: (props: {
    section: S
    problems: ReturnType<typeof sectionProblems>
    onChange: (next: S) => void
  }) => ReactNode,
  section: S
) {
  const changes: S[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <Form
        section={value}
        problems={sectionProblems(value)}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
      />
    )
  }
  wrap(<Holder />)
  return changes
}

const bands = (id = "fiyatbant") => newHomeSection("price_bands", id) as PriceBandsSection

/** adr/0049 Ek 2026-11-14, Katalog ana sayfası: the price bands in the theme editor. */
describe("PriceBandsForm", () => {
  it("is offered on the home page, new with three rising bands whose labels are to write", () => {
    expect(HOME_TYPES).toContain("price_bands")
    expect(bands().bands.map((band) => band.max)).toEqual([500, 1000, null])
    expect(sectionProblems(bands())).toEqual({
      "bands.0.label": "required",
      "bands.1.label": "required",
      "bands.2.label": "required",
    })
  })

  it("marks bands that do not rise, and an open band before the last", () => {
    const falling = {
      ...bands(),
      bands: [
        { label: "A", text: null, max: 900 },
        { label: "B", text: null, max: 100 },
      ],
    }
    const openFirst = {
      ...bands(),
      bands: [
        { label: "A", text: null, max: null },
        { label: "B", text: null, max: 100 },
      ],
    }

    expect(sectionProblems(falling)).toEqual({ bands: "bandsOrder" })
    expect(sectionProblems(openFirst)).toEqual({ bands: "bandsOrder" })
  })

  it("suggests a label from the bound, adds a band before the open last one, and turns pictures off", async () => {
    const user = userEvent.setup()
    const changes = holder(PriceBandsForm, bands())

    expect(screen.getAllByPlaceholderText("500 TL'ye kadar")).toHaveLength(1)
    expect(screen.getAllByPlaceholderText("1.000 TL üzeri")).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: "Bant ekle" }))
    expect(changes.at(-1)?.bands.map((band) => band.max)).toEqual([500, 1000, 2000, null])
    expect(screen.getByRole("button", { name: "Bant ekle" })).toBeDisabled()

    await user.click(screen.getByRole("switch", { name: /Ürün görselleri/ }))
    expect(changes.at(-1)?.thumbs).toBe(0)
  })

  it("takes a category per band, its price limit optional and the price bands' order apart", async () => {
    const user = userEvent.setup()
    const strip: PriceBandsSection = {
      ...bands(),
      bands: [
        { label: "Ucuzlar", text: null, max: 500, category_id: null },
        { label: "Koleksiyon", text: null, max: null, category_id: "pcat_koleksiyon" },
        { label: "Üstü", text: null, max: null, category_id: null },
      ],
    }
    const changes = holder(PriceBandsForm, strip)

    // Every band offers its category, marked optional and explained
    expect(screen.getAllByText("Kategori (isteğe bağlı)")).toHaveLength(3)
    expect(screen.getAllByText(/küçük görseller de bu kategoriden seçilir/)).toHaveLength(3)
    // A category band without a price: no bound, a price limit to turn on; the open price band still last
    expect(screen.getAllByLabelText("Üst sınır (TL)")).toHaveLength(1)
    expect(screen.getByPlaceholderText("Kategorinin adı ya da kısa bir ad")).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /Üst sınır yok/ })).toBeChecked()
    expect(sectionProblems(strip)).toEqual({})

    await user.click(screen.getByRole("switch", { name: /Fiyat sınırı/ }))
    expect(changes.at(-1)?.bands[1]).toMatchObject({ category_id: "pcat_koleksiyon", max: 500 })
    expect(screen.getAllByLabelText("Üst sınır (TL)")).toHaveLength(2)
    expect(screen.getByText(/kategori sayfası bu fiyatla süzülür/)).toBeInTheDocument()

    // Taken back: a price band again, its bound kept
    await user.click(screen.getByRole("button", { name: /seçimini kaldır/ }))
    expect(changes.at(-1)?.bands[1]).toEqual({
      label: "Koleksiyon",
      text: null,
      max: 500,
      category_id: null,
    })
    expect(screen.queryByRole("button", { name: /seçimini kaldır/ })).toBeNull()
  })

  it("makes a band without a price a price band before the next one when its category is taken back", async () => {
    const user = userEvent.setup()
    const changes = holder(PriceBandsForm, {
      ...bands(),
      bands: [
        { label: "Koleksiyon", text: null, max: null, category_id: "pcat_koleksiyon" },
        { label: "Ucuzlar", text: null, max: 500, category_id: null },
        { label: "Üstü", text: null, max: null, category_id: null },
      ],
    })

    await user.click(screen.getByRole("button", { name: /seçimini kaldır/ }))
    const next = changes.at(-1)
    expect(next?.bands[0]).toMatchObject({ category_id: null, max: 500 })
    // Not rising yet: the shop is told, the save refused until it is fixed
    expect(next && sectionProblems(next)).toEqual({ bands: "bandsOrder" })
  })
})

const hero = () => newHomeSection("hero", "girisbolum") as HeroSection

describe("the opening's category list (H17) in the editor", () => {
  it("adds today's opening; switching to the list starts its fields and keeps the words", () => {
    const written = { ...hero(), heading: "Elmax çakılar" }
    const listed = switchVariant(written, "category_list")

    expect(hero().variant).toBe("standard")
    expect(listed).toMatchObject({
      variant: "category_list",
      heading: "Elmax çakılar",
      list: { kind: "top" },
      list_limit: 9,
      show_count: true,
      tiles: [],
      chips: [],
      picks: [],
      show_price: true,
    })
    expect(switchVariant(listed, "standard")).toEqual(written)
  })

  it("shows the list's fields only in its variant and asks for a category when the shop picks them", async () => {
    const user = userEvent.setup()
    const changes = holder(HeroForm, switchVariant(hero(), "category_list"))

    expect(screen.getByRole("radio", { name: "Ana kategoriler" })).toBeChecked()
    await user.click(screen.getByRole("radio", { name: "Seçtiklerim" }))
    const last = changes.at(-1)
    expect(last?.variant === "category_list" ? last.list : null).toEqual({
      kind: "manual",
      category_ids: [],
    })
    expect(sectionProblems(last ?? hero())).toEqual({ list: "categoryRequired" })
  })

  it("names the new fields in both languages", () => {
    for (const dict of [tr, en]) {
      const editor = dict.storefront.editor as unknown as Record<string, Record<string, unknown>>
      expect(editor["types"]?.["price_bands"]).toBeTruthy()
      expect(editor["heroCatalog"]?.["showCount"]).toBeTruthy()
      expect(editor["priceBands"]?.["labelUnder"]).toBeTruthy()
      expect(editor["problems"]?.["bandsOrder"]).toBeTruthy()
      expect(editor["defaults"]?.["price_bands"]).toBeTruthy()
    }
  })
})
