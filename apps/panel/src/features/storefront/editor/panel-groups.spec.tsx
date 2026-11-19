import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SECTION_VARIANTS } from "@qticaret/types"
import type { AnySection, LayoutGroup } from "@/features/storefront/api/layout"
import {
  CATEGORY_TYPES,
  HOME_TYPES,
  PAGE_TYPES,
  PRODUCT_TYPES,
  newBodySection,
  newFooterNewsletter,
  newHeaderMarquee,
  newHomeSection,
} from "@/features/storefront/layout/sections"
import { offersVariants, switchVariant } from "@/features/storefront/layout/variants"
import { sectionFields } from "./forms/field-registry"
import { PANEL_GROUPS, tabOfGroup } from "./panel-groups"
import { PanelGroup } from "./panel-header"
import { renderPanel } from "./section-panel.fixtures"
import { SettingsLayout } from "./settings-layout"
import { DOC } from "./theme-editor.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

/** Each variant of a section that has more than one, else the section itself. */
function withVariants(section: AnySection): AnySection[] {
  if (!offersVariants(section)) {
    return [section]
  }
  const variants: readonly string[] = SECTION_VARIANTS[section.type]
  return variants.map((variant) => switchVariant(section, variant as never))
}

const name = (section: AnySection) =>
  "variant" in section ? `${section.type} (${section.variant})` : section.type

/** Every kind of section panel the editor opens: each type of each page, in each variant. */
const SAMPLES: [string, LayoutGroup, AnySection][] = [
  ...HOME_TYPES.flatMap((type) => withVariants(newHomeSection(type, "ornekbolum1"))).map(
    (section): [string, LayoutGroup, AnySection] => [name(section), "home", section]
  ),
  // The featured product's strips' own look shows only with the strips chosen
  [
    "featured_product (strips gallery)",
    "home",
    { ...newHomeSection("featured_product", "oneurun001"), gallery: "strips" } as AnySection,
  ],
  ...PRODUCT_TYPES.flatMap((type) =>
    withVariants(newBodySection("product", type, "urunbolum1"))
  ).map((section): [string, LayoutGroup, AnySection] => [
    `product: ${name(section)}`,
    "product",
    section,
  ]),
  ...CATEGORY_TYPES.map((type) => newBodySection("category", type, "katbolum01")).map(
    (section): [string, LayoutGroup, AnySection] => [
      `category: ${name(section)}`,
      "category",
      section,
    ]
  ),
  // A content page's own sections (adr/0073): the home page's types, with their side of the text
  ...PAGE_TYPES.flatMap((type) => withVariants(newBodySection("pages", type, "sayfabolum1"))).map(
    (section): [string, LayoutGroup, AnySection] => [`pages: ${name(section)}`, "pages", section]
  ),
  ...[...DOC.header, newHeaderMarquee("ustkayan01")]
    .flatMap(withVariants)
    .map((section): [string, LayoutGroup, AnySection] => [
      `header: ${name(section)}`,
      "header",
      section,
    ]),
  ...[...DOC.footer, newFooterNewsletter("altbulten1")]
    .flatMap(withVariants)
    .map((section): [string, LayoutGroup, AnySection] => [
      `footer: ${name(section)}`,
      "footer",
      section,
    ]),
  ...[...DOC.product, ...DOC.category]
    .filter((section) => section.type === "product_main" || section.type === "category_main")
    .map((section): [string, LayoutGroup, AnySection] => [
      `main: ${section.type}`,
      section.type === "product_main" ? "product" : "category",
      section,
    ]),
]

const groupsDrawn = () =>
  [...document.querySelectorAll<HTMLElement>("[data-panel-group]")].map(
    (group) => group.dataset["panelGroup"] ?? ""
  )

/**
 * adr/0065 Ek (sekmeler): every setting of every section panel stands in
 * a tab and a group `panel-groups.ts` lists, where the settings search
 * says it is. A group a form draws without its line fails here.
 */
describe("every section panel's groups", { timeout: 60_000 }, () => {
  it("covers each kind of panel", () => {
    expect(SAMPLES.length).toBeGreaterThan(30)
  })

  it.each(SAMPLES)("%s: each group is listed, each field sits in its own", (_, group, section) => {
    const { unmount } = renderPanel(section, group)
    const drawn = groupsDrawn()
    expect(drawn.length).toBeGreaterThan(0)
    for (const each of drawn) {
      expect(Object.hasOwn(PANEL_GROUPS, each), `group "${each}" not in PANEL_GROUPS`).toBe(true)
    }
    for (const field of sectionFields(section, group)) {
      const element = document.getElementById(field.target)
      expect(element, `${field.key}: #${field.target} not drawn`).not.toBeNull()
      const holder = element?.closest<HTMLElement>("[data-panel-group]")?.dataset["panelGroup"]
      expect(holder, `${field.key} drawn in "${String(holder)}"`).toBe(field.group)
    }
    unmount()
  })
})

/** A form's group drawn before its line in `PANEL_GROUPS` (or with no name at all). */
function Unlisted() {
  const [words, setWords] = useState("")
  return (
    <SettingsLayout scope="test" resetKey="test" tabOf={tabOfGroup} focus={null}>
      <PanelGroup name="variant" title="Biçim">
        <p>Biçimler</p>
      </PanelGroup>
      <PanelGroup name="diagonalStrips" title="Çapraz şeritler">
        <label htmlFor="serit-metin">Şerit yazısı</label>
        <input
          id="serit-metin"
          value={words}
          onChange={(event) => {
            setWords(event.target.value)
          }}
        />
      </PanelGroup>
      <PanelGroup title="Adsız grup">
        <label htmlFor="adsiz-alan">Adsız alan</label>
        <input id="adsiz-alan" />
      </PanelGroup>
    </SettingsLayout>
  )
}

describe("a group not listed yet", () => {
  it("still shows, in İçerik under its own title, its fields working and found", async () => {
    const user = userEvent.setup()
    render(<Unlisted />)
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab")
    expect(tabs.map((tab) => tab.textContent)).toEqual(["İçerikcontent", "Stilstyle"])
    expect(screen.getByRole("tab", { selected: true })).toHaveAccessibleName(/^İçerik/)
    const strips = screen.getByRole("button", { name: "Çapraz şeritler" })
    expect(strips).toBeVisible()
    expect(screen.getByRole("button", { name: "Adsız grup" })).toBeVisible()

    await user.click(strips)
    await user.type(screen.getByRole("textbox", { name: "Şerit yazısı" }), "Kış indirimi")
    expect(screen.getByRole("textbox", { name: "Şerit yazısı" })).toHaveValue("Kış indirimi")

    await user.click(screen.getByRole("tab", { name: /^Stil/ }))
    await user.type(screen.getByRole("searchbox"), "serit yazisi{Enter}")
    expect(screen.getByRole("tab", { selected: true })).toHaveAccessibleName(/^İçerik/)
    expect(screen.getByRole("textbox", { name: "Şerit yazısı" })).toHaveFocus()
  })
})
