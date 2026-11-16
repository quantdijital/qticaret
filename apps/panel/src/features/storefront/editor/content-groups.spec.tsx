import { act, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnySection, LayoutGroup } from "@/features/storefront/api/layout"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { CARD_FIELD_IDS } from "./forms/card-field-ids"
import { PREVIEW_IDS } from "./forms/preview-fields"
import { renderPanel } from "./section-panel.fixtures"
import { openGroup, openTab } from "./settings-groups.fixtures"
import { DOC } from "./theme-editor.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const STORE = "qticaret.editor.groups.v1"

/** The shown tab's group headers: each title and whether it stands open. */
const headers = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      "[data-panel-group]:not([hidden]) h3 > button[aria-expanded]"
    ),
  ].map((button) => [
    button.querySelector("[data-panel-group-title]")?.textContent ?? "",
    button.getAttribute("aria-expanded") === "true",
  ])

const home = (type: AnySection["type"], id: string) => newHomeSection(type as never, id)
const variant = (section: AnySection, name: string): AnySection =>
  switchVariant(section as never, name as never)
const footer = () => {
  const bar = DOC.footer.find((section) => section.type === "footer_bar")
  if (!bar) throw new Error("no footer bar")
  return bar
}

/**
 * The content tab in groups (docs/18 §7.1, the owner's "her şey açılır
 * kapanır başlıklar altında"): a long content splits into titled groups,
 * the first, the section's main content, open, the rest closed down to
 * their titles; a short one stays one group, open with no header.
 */
const SPLIT: [string, AnySection, LayoutGroup, string[]][] = [
  ["the opening", home("hero", "giris00001"), "home", ["İçerik", "Düğmeler"]],
  [
    "the catalogue opening",
    variant(home("hero", "giris00002"), "category_list"),
    "home",
    ["İçerik", "Kategori listesi", "Yandaki karolar", "Hızlı bağlantılar", "Küçük ürünler"],
  ],
  ["the sliding opening", home("hero_slider", "slayt00001"), "home", ["İçerik", "Seçenekler"]],
  [
    "the linked categories",
    variant(home("categories", "kategori01"), "linked"),
    "home",
    ["İçerik", "Kartlar"],
  ],
  [
    "the categories' collage",
    variant(home("categories", "kategori02"), "collage"),
    "home",
    ["İçerik", "Kartlar"],
  ],
  ["the price bands", home("price_bands", "fiyat00001"), "home", ["İçerik", "Ürün görselleri"]],
  ["the questions", home("faq", "sss0000001"), "home", ["İçerik", "Soruların açılışı"]],
  ["the footer", footer(), "footer", ["İçerik", "Yukarı çık düğmesi"]],
]

describe("the content tab's groups", () => {
  it.each(SPLIT)("%s: İçerik first and open, the rest closed", (_, section, group, titles) => {
    renderPanel(section, group)
    expect(headers()).toEqual(titles.map((title, at) => [title, at === 0]))
  })

  it("keeps a short content one group, open with no header to fold it", () => {
    renderPanel(home("brands", "markalar01"))
    expect(headers()).toEqual([])
    expect(screen.getByRole("textbox", { name: "Başlık" })).toBeVisible()
  })

  it("opens Stil at its variant alone, every other group titled and closed", async () => {
    const user = userEvent.setup()
    renderPanel(home("hero", "giris00001"))
    await openTab(user, "style")
    const shown = headers()
    expect(shown.length).toBeGreaterThan(1)
    expect(shown[0]).toEqual(["Biçim", true])
    expect(shown.slice(1).every(([, open]) => !open)).toBe(true)
  })

  it("puts what the variant does behind Biçim's (i), not under the choices", async () => {
    const user = userEvent.setup()
    renderPanel(home("hero", "giris00001"))
    await openTab(user, "style")
    expect(screen.getByRole("button", { name: "Bilgi: Biçim" })).toHaveAccessibleDescription(
      /Bölümün vitrinde nasıl görüneceği/
    )
    expect(screen.getByRole("group", { name: "Biçim" })).not.toHaveAttribute("aria-describedby")
  })

  it("remembers a group opened, old records read as before", async () => {
    // A record from before the content groups: its own names kept, a name no longer drawn ignored
    window.localStorage.setItem(
      STORE,
      JSON.stringify({ "section:faq": { variant: false, gone: true }, other: "x" })
    )
    const user = userEvent.setup()
    const first = renderPanel(home("faq", "sss0000001"))
    expect(headers()).toEqual([
      ["İçerik", true],
      ["Soruların açılışı", false],
    ])
    await openGroup(user, "Soruların açılışı")
    expect(JSON.parse(window.localStorage.getItem(STORE) ?? "{}")).toMatchObject({
      "section:faq": { variant: false, gone: true, opening: true },
      other: "x",
    })
    first.unmount()
    // Another question list opens as the shop left the last one
    renderPanel(home("faq", "sss0000002"))
    expect(headers()).toEqual([
      ["İçerik", true],
      ["Soruların açılışı", true],
    ])
  })

  it("opens a closed group when the preview picks a field in it", () => {
    const hero = {
      ...home("hero", "giris00001"),
      links: [{ kind: "system", target: "shop", label: null }],
    } as AnySection
    const { pick } = renderPanel(hero)
    const target = PREVIEW_IDS.text("giris00001", "links.0")
    expect(headers()).toContainEqual(["Düğmeler", false])
    act(() => {
      pick({ target, group: "buttons", nonce: 1 })
    })
    expect(headers()).toContainEqual(["Düğmeler", true])
    expect(document.getElementById(target)).toHaveAttribute("data-highlight")
  })

  it("finds a setting in a closed group, says what it does and lands on it", async () => {
    const user = userEvent.setup()
    renderPanel(home("faq", "sss0000001"))
    await user.type(screen.getByRole("searchbox"), "ilk soru acik")
    const hits = within(screen.getByRole("list", { name: "Bulunan ayarlar" }))
    const hit = hits.getByRole("button", { name: /İlk soru açık gelsin/ })
    expect(hit).toHaveTextContent("İçerik › Soruların açılışı")
    expect(hit).toHaveTextContent("Sayfa açıldığında ilk sorunun cevabı görünür.")
    await user.click(hit)
    expect(headers()).toContainEqual(["Soruların açılışı", true])
    expect(screen.getByRole("switch", { name: /İlk soru açık gelsin/ })).toHaveFocus()
  })

  it("marks a closed group holding a setting off its default", () => {
    const linked = { ...variant(home("categories", "kategori01"), "linked"), columns: 4 }
    renderPanel(linked as AnySection)
    const cards = screen.getByRole("button", { name: /^Kartlar/ })
    expect(cards).toHaveAttribute("aria-expanded", "false")
    expect(cards).toHaveAccessibleName(/1 ayar varsayılandan farklı/)
    expect(document.getElementById(CARD_FIELD_IDS.card("kategori01", "columns"))).not.toBeNull()
  })
})
