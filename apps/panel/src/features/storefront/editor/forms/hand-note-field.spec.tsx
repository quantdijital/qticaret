import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { HAND_NOTE_MAX } from "@qticaret/types"
import type { CardVariant } from "@qticaret/types"
import { i18next } from "@/lib/i18n"
import type { AnySection, BannerSection, HeroSection } from "@/features/storefront/api/layout"
import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import type { ThemeChoices as Choices, ThemeSettings } from "@/features/storefront/api/theme"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { isGrafit, themeValuesOf } from "@/features/storefront/theme-settings"
import en from "@/locales/en.json"
import tr from "@/locales/tr.json"
import { SectionPanel } from "../section-panel"
import { searchTheme } from "../settings-search"
import { ThemeChoices } from "../theme-choices"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))

type Full = Extract<HeroSection, { variant: "full_image" }>

const full = (over: Partial<Full> = {}): Full => ({
  ...(switchVariant(newHomeSection("hero", "kapak00001") as HeroSection, "full_image") as Full),
  ...over,
})
const band = (over: Partial<BannerSection> = {}): BannerSection => ({
  ...(newHomeSection("banner", "kampanya1") as BannerSection),
  slides: [
    {
      image: { url: "http://localhost:9000/static/vadi.webp", alt: "Vadi" },
      mobile_image: null,
      heading: "Sıradaki maceranız",
      text: null,
      link: null,
      second_link: null,
      tone: "light",
    },
  ],
  ...over,
})
const split = (over: Partial<BannerSection> = {}): BannerSection => ({
  ...switchVariant(band(), "split"),
  ...over,
})

/** The section's panel with its problems as the editor finds them: every change kept. */
function renderPanel(section: AnySection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <SectionPanel
        section={value}
        group="home"
        problems={sectionProblems(value)}
        canDuplicate
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
        onPlace={vi.fn()}
        onBack={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        badges={[]}
        onBadges={vi.fn()}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Holder />
    </QueryClientProvider>
  )
  return changes
}

const noteBox = () => screen.queryByRole("textbox", { name: /^Not/ })
const noteField = () => screen.getByRole("textbox", { name: /^Not/ })

describe("a section's hand note in the panel", () => {
  it("names the note and the accent font in both languages", () => {
    for (const words of [tr, en]) {
      const { heroFull, banner, theme } = words.storefront.editor
      for (const note of [heroFull.note, banner.note]) {
        for (const key of ["label", "term", "placeholder", "hint"] as const) {
          expect(note[key]).toBeTruthy()
        }
      }
      expect(Object.keys(theme.accentFonts)).toEqual(["none", "caveat", "dancing-script", "kalam"])
      expect(theme.accentFont && theme.accentFontTerm && theme.accentFontHint).toBeTruthy()
    }
    expect(tr.storefront.editor.heroFull.note.hint).toMatch(
      /Vurgu yazı tipi açıksa el yazısıyla görünür/
    )
  })

  it("takes the full image opening's note, empty at first, over its heading", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(full())
    const box = noteField()
    expect(box).toHaveValue("")
    expect(box).toHaveAttribute("id", "kapak00001-note")

    await user.click(box)
    await user.paste("Sizi bekliyoruz!")
    expect(changes.at(-1)).toMatchObject({ variant: "full_image", note: "Sizi bekliyoruz!" })
  })

  it("has no note field on today's opening", () => {
    renderPanel(newHomeSection("hero", "kapak00002"))
    expect(noteBox()).toBeNull()
  })

  it("has no note field on today's band", () => {
    renderPanel(band())
    expect(noteBox()).toBeNull()
  })

  it("takes the split band's note", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(split())
    const box = noteField()
    expect(box).toHaveValue("")

    await user.click(box)
    await user.paste("Son 3 yer!")
    expect(changes.at(-1)).toMatchObject({ variant: "split", note: "Son 3 yer!" })
  })

  it("starts with no note when switched to either variant", () => {
    expect(full().note).toBeNull()
    expect(split().note).toBeNull()
    expect(band()).not.toHaveProperty("note")
  })

  it("finds a note too long before the save", () => {
    const long = "a".repeat(HAND_NOTE_MAX + 1)
    expect(sectionProblems(full({ note: "a".repeat(HAND_NOTE_MAX) }))["note"]).toBeUndefined()
    expect(sectionProblems(full({ note: long }))["note"]).toBe("tooLong")
    expect(sectionProblems(split({ note: long }))["note"]).toBe("tooLong")
    expect(sectionProblems(band({ note: long }))["note"]).toBeUndefined()
  })
})

describe("the theme's accent font in the panel", () => {
  const THEME: ThemeSettings = { settings_version: 2, theme: "atolye", ...GRAFIT_THEME }
  const standard: ReadonlySet<CardVariant> = new Set(["standard"])

  it("shows none for a theme saved before it, and writes the face picked", async () => {
    const onChange = vi.fn()
    render(
      <ThemeChoices theme={THEME} variants={standard} reveal={() => null} onChange={onChange} />
    )
    const box = screen.getByRole("combobox", { name: /^Vurgu yazı tipi/ })
    expect(box).toHaveTextContent("Yok")
    expect(box).toHaveAttribute("id", "theme-typography-accent")
    expect(screen.getByText("el yazısı · font-family").tagName).toBe("SMALL")

    const user = userEvent.setup()
    await user.click(box)
    await user.click(await screen.findByRole("option", { name: /Caveat/ }))
    expect(onChange).toHaveBeenLastCalledWith({
      ...THEME,
      typography: { ...THEME.typography, accent: "caveat" },
    })
  })

  it("is found by its name and by 'el yazısı'; none is Grafit's", () => {
    const t = (key: string) => i18next.t(key)
    const found = (query: string) =>
      searchTheme(query, THEME, standard, t).map((hit) => hit.field.key)
    expect(found("vurgu yazı")).toContain("typography.accent")
    expect(found("el yazısı")).toContain("typography.accent")
    expect(found("caveat")).toContain("typography.accent")

    expect(isGrafit(themeValuesOf(GRAFIT_THEME))).toBe(true)
    const none: Choices = {
      ...GRAFIT_THEME,
      typography: { ...GRAFIT_THEME.typography, accent: "none" },
    }
    expect(isGrafit(themeValuesOf(none))).toBe(true)
    const caveat: Choices = {
      ...GRAFIT_THEME,
      typography: { ...GRAFIT_THEME.typography, accent: "caveat" },
    }
    expect(isGrafit(themeValuesOf(caveat))).toBe(false)
  })
})
