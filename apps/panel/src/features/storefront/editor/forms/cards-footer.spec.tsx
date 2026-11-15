import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { CATEGORY_CARD_DEFAULTS, FOOTER_BAR_DEFAULTS } from "@qticaret/types"
import { i18next } from "@/lib/i18n"
import type {
  AnySection,
  CategoriesSection,
  FooterBarSection,
} from "@/features/storefront/api/layout"
import { switchVariant } from "@/features/storefront/layout/variants"
import { searchSettings } from "../settings-search"
import { cardsSetCount } from "./card-field-ids"
import { CategoryCardsFields, CategoryCardsOther } from "./category-cards-fields"
import { FooterBarForm } from "./footer-bar-form"
import { VariantField } from "./variant-field"

const tiles: CategoriesSection = {
  id: "kategoriler",
  type: "categories",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "tiles",
  title: null,
  category_ids: [],
  show_count: false,
  more: null,
}

const footer: FooterBarSection = {
  id: "mainfooter",
  type: "footer_bar",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "ledger",
  ...FOOTER_BAR_DEFAULTS,
  payment_badges: [],
}

/** A form holding its section, every change kept. */
function renderHeld<S extends AnySection>(
  section: S,
  draw: (value: S, keep: (next: S) => void) => React.ReactNode
) {
  const changes: S[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return draw(value, (next) => {
      changes.push(next)
      setValue(next)
    })
  }
  render(<Holder />)
  return changes
}

const linked = (): CategoriesSection => switchVariant<CategoriesSection>(tiles, "linked")

const search = (query: string, section: AnySection, group: "home" | "footer") =>
  searchSettings(query, [{ section, group, names: [] }], i18next.t.bind(i18next)).map(
    (hit) => hit.field?.key ?? null
  )

/** adr/0049 Ek 2026-11-15: the linked category cards in the panel. */
describe("the linked category cards' settings", () => {
  it("is offered beside the tiles, each drawn in small", async () => {
    const picked: string[] = []
    render(
      <VariantField id="v" type="categories" value="tiles" onChange={(next) => picked.push(next)} />
    )
    expect(screen.getByRole("radio", { name: /Görselli karo/ })).toBeChecked()
    await userEvent.click(screen.getByRole("radio", { name: /Alt kategorili kart/ }))
    expect(picked).toEqual(["linked"])
  })

  it("starts a switched section from the defaults and drops them when switched back", () => {
    expect(linked()).toEqual({ ...tiles, variant: "linked", ...CATEGORY_CARD_DEFAULTS })
    expect(switchVariant({ ...linked(), columns: 4 }, "tiles")).toEqual(tiles)
  })

  it("changes the columns, the picture's place and the links; the frame closed with the look", async () => {
    const changes = renderHeld(linked(), (value, keep) =>
      value.variant === "linked" ? (
        <>
          <CategoryCardsFields section={value} onChange={keep} />
          <CategoryCardsOther section={value} onChange={keep} />
        </>
      ) : null
    )
    await userEvent.click(screen.getByRole("radio", { name: "4" }))
    expect(changes.at(-1)).toMatchObject({ columns: 4 })
    await userEvent.click(screen.getByRole("radio", { name: "Üstte" }))
    expect(changes.at(-1)).toMatchObject({ image_position: "top" })
    const links = screen.getByRole("spinbutton", { name: /Alt kategori sayısı/ })
    fireEvent.change(links, { target: { value: "0" } })
    expect(changes.at(-1)).toMatchObject({ links: 0 })
    // Past the most, the most
    fireEvent.change(links, { target: { value: "12" } })
    expect(changes.at(-1)).toMatchObject({ links: 8 })
    await userEvent.click(screen.getByRole("radio", { name: "Düz zemin" }))
    expect(changes.at(-1)).toMatchObject({ frame: "plain" })
    expect(cardsSetCount(changes.at(-1) as AnySection)).toBe(1)
    expect(cardsSetCount(linked())).toBe(0)
    expect(cardsSetCount(tiles)).toBe(0)
  })

  it("is found by its everyday words and terms only while the cards are linked", () => {
    expect(search("çerçeve", linked(), "home")).toContain("cards.frame")
    expect(search("alt kategori", linked(), "home")).toContain("cards.links")
    expect(search("yanda", linked(), "home")).toContain("cards.image_position")
    expect(search("çerçeve", tiles, "home")).not.toContain("cards.frame")
  })
})

/** adr/0049 Ek 2026-11-15: the footer's profiles, ways to pay and back to top button. */
describe("the footer's settings", () => {
  it("shows the profiles as icons and picks, orders and drops ways to pay", async () => {
    const changes = renderHeld(footer, (value, keep) => (
      <FooterBarForm section={value} problems={{}} onChange={keep} />
    ))
    await userEvent.click(screen.getByRole("radio", { name: "Simgeyle" }))
    expect(changes.at(-1)).toMatchObject({ social: "icons" })

    await userEvent.click(screen.getByRole("checkbox", { name: "Troy" }))
    await userEvent.click(screen.getByRole("checkbox", { name: "Kapıda ödeme" }))
    expect(changes.at(-1)).toMatchObject({ payment_badges: ["troy", "cash_on_delivery"] })
    // The first can go no higher; the picked ones stand first, in order
    expect(screen.getByRole("button", { name: /Troy rozetini yukarı/ })).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: /Kapıda ödeme rozetini yukarı/ }))
    expect(changes.at(-1)).toMatchObject({ payment_badges: ["cash_on_delivery", "troy"] })
    const names = within(screen.getByRole("group", { name: /Ödeme rozetleri/ }))
      .getAllByRole("checkbox")
      .slice(0, 2)
      .map((box) => box.id)
    expect(names).toEqual([
      "mainfooter-footer-payment_badges-cash_on_delivery",
      "mainfooter-footer-payment_badges-troy",
    ])
    await userEvent.click(screen.getByRole("checkbox", { name: "Troy" }))
    expect(changes.at(-1)).toMatchObject({ payment_badges: ["cash_on_delivery"] })
  })

  it("shows the button's corner, face and phones only while it is on", async () => {
    const changes = renderHeld(footer, (value, keep) => (
      <FooterBarForm section={value} problems={{}} onChange={keep} />
    ))
    expect(screen.queryByText(/Düğmenin yeri/)).toBeNull()
    await userEvent.click(screen.getByRole("switch", { name: /Yukarı çık düğmesi/ }))
    expect(changes.at(-1)).toMatchObject({ back_to_top: true })
    await userEvent.click(screen.getByRole("radio", { name: "Solda" }))
    await userEvent.click(screen.getByRole("radio", { name: "Köşeli" }))
    await userEvent.click(screen.getByRole("switch", { name: /Telefonda da göster/ }))
    expect(changes.at(-1)).toMatchObject({
      back_to_top_side: "left",
      back_to_top_shape: "square",
      back_to_top_mobile: false,
    })
  })

  it("is found by its words, a way to pay by its name, the button's details only while it is on", () => {
    expect(search("rozet", footer, "footer")).toContain("footer.payment_badges")
    expect(search("troy", footer, "footer")).toContain("footer.payment_badges")
    expect(search("sosyal", footer, "footer")).toContain("footer.social")
    expect(search("back to top", footer, "footer")).toContain("footer.back_to_top")
    expect(search("düğmenin yeri", footer, "footer")).not.toContain("footer.back_to_top_side")
    expect(search("düğmenin yeri", { ...footer, back_to_top: true }, "footer")).toContain(
      "footer.back_to_top_side"
    )
  })
})
