import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { MARQUEE_DEFAULTS } from "@qticaret/types"
import { i18next } from "@/lib/i18n"
import type { MarqueeSection } from "@/features/storefront/api/layout"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { searchSettings } from "../settings-search"
import {
  MARQUEE_APPEARANCE_SETTINGS,
  MARQUEE_MOTION_SETTINGS,
  MARQUEE_OTHER_SETTINGS,
} from "./field-registry"
import { MarqueeGroups } from "./marquee-groups"
import { MarqueeSettings } from "./marquee-settings"

/** A setting's field, by the id the settings search lands on. */
const field = (setting: string) => {
  const element = document.getElementById(`kayanyazi-marquee-${setting}`)
  if (!element) throw new Error(`no field ${setting}`)
  return element
}

const newStrip = (more: Partial<MarqueeSection> = {}) => ({
  ...(newHomeSection("marquee", "kayanyazi") as MarqueeSection),
  ...more,
})

/** The strip's two open groups and its closed ones' settings, every change kept. */
function renderGroups(section = newStrip()) {
  const changes: MarqueeSection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    const keep = (next: MarqueeSection) => {
      changes.push(next)
      setValue(next)
    }
    return (
      <>
        <MarqueeGroups section={value} reveal={() => null} onChange={keep} />
        <MarqueeSettings section={value} settings={MARQUEE_OTHER_SETTINGS} onChange={keep} />
      </>
    )
  }
  render(<Holder />)
  return changes
}

/** adr/0049 Ek 2026-11-15: the owner's eight settings, the basic ones never folded away. */
describe("a scrolling strip's settings", () => {
  it("sets motion first, then the look, the rare ones last", () => {
    expect(MARQUEE_MOTION_SETTINGS).toEqual(["speed", "direction", "hover_pause", "pause_button"])
    expect(MARQUEE_APPEARANCE_SETTINGS).toEqual([
      "size",
      "ground",
      "separator",
      "weight",
      "uppercase",
      "gap",
      "outline",
    ])
    expect(MARQUEE_OTHER_SETTINGS).toEqual(["closable"])
  })

  it("opens the motion and look groups at first", () => {
    renderGroups()
    expect(screen.getByRole("button", { name: "Hareket" })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "Stil" })).toHaveAttribute("aria-expanded", "true")
  })

  it("moves the speed over five stops, read out by name", async () => {
    const changes = renderGroups()
    const speed = screen.getByRole("slider", { name: /Hız/ })

    expect(speed).toHaveAttribute("aria-valuetext", "Orta")
    fireEvent.change(speed, { target: { value: "4" } })
    expect(changes.at(-1)).toMatchObject({ speed: "fastest" })
    expect(speed).toHaveAttribute("aria-valuetext", "Çok hızlı")
    fireEvent.change(speed, { target: { value: "0" } })
    expect(changes.at(-1)).toMatchObject({ speed: "slowest" })
    await userEvent.click(within(field("speed")).getByRole("button", { name: "Varsayılana dön" }))
    expect(changes.at(-1)).toMatchObject({ speed: "medium" })
  })

  it("offers the pause button on hover, never without it", async () => {
    const changes = renderGroups()
    const group = field("pause_button")

    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual(["Her zaman", "Üzerine gelince"])
    await userEvent.click(within(group).getByRole("radio", { name: /Üzerine gelince/ }))
    expect(changes.at(-1)).toMatchObject({ pause_button: "hover" })
    expect(screen.getByText(/Düğme tamamen kaldırılamaz/)).toBeInTheDocument()
  })

  it("turns the on/off settings with a switch", async () => {
    const changes = renderGroups()

    await userEvent.click(screen.getByRole("switch", { name: /Üzerine gelince dur/ }))
    expect(changes.at(-1)).toMatchObject({ hover_pause: "off" })
    await userEvent.click(screen.getByRole("switch", { name: /Büyük harf/ }))
    expect(changes.at(-1)).toMatchObject({ uppercase: "on" })
    await userEvent.click(screen.getByRole("switch", { name: /Kapatma düğmesi/ }))
    expect(changes.at(-1)).toMatchObject({ closable: "on" })
  })

  it("picks its size, and offers the outline only at the large size", async () => {
    const changes = renderGroups()
    const size = field("size")

    expect(screen.queryByRole("switch", { name: /çerçeve/ })).not.toBeInTheDocument()
    await userEvent.click(within(size).getByRole("radio", { name: /Büyük/ }))
    expect(changes.at(-1)).toMatchObject({ size: "large" })
    await userEvent.click(screen.getByRole("switch", { name: /çerçeve/ }))
    expect(changes.at(-1)).toMatchObject({ outline: "on" })
  })

  it("picks the room between items, its screens no longer among its own settings", async () => {
    const changes = renderGroups()

    await userEvent.click(screen.getByRole("radio", { name: /Geniş/ }))
    expect(changes.at(-1)).toMatchObject({ gap: "wide" })
    expect(screen.queryByRole("radio", { name: /Yalnız telefonda/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("radio", { name: /Kalın/ }))
    expect(changes.at(-1)).toMatchObject({ weight: "bold" })
  })

  it("is found by its everyday words and technical terms", () => {
    const t = i18next.t.bind(i18next)
    const sections = [{ section: newStrip({ size: "large" }), group: "home" as const, names: [] }]
    const keys = (query: string) =>
      searchSettings(query, sections, t).map((hit) => hit.field?.key ?? null)

    expect(keys("hız")).toContain("marquee.speed")
    expect(keys("speed")).toContain("marquee.speed")
    expect(keys("durdur")).toContain("marquee.pause_button")
    expect(keys("pause")).toEqual(
      expect.arrayContaining(["marquee.pause_button", "marquee.hover_pause"])
    )
    expect(keys("büyük harf")).toContain("marquee.uppercase")
    expect(keys("uppercase")).toContain("marquee.uppercase")
    expect(keys("boşluk")).toContain("marquee.gap")
    expect(keys("gap")).toContain("marquee.gap")
    expect(keys("telefon")).toContain("device")
    expect(keys("kapat")).toContain("marquee.closable")
    expect(keys("çerçeve")).toContain("marquee.outline")
    expect(MARQUEE_DEFAULTS.pause_button).toBe("always")
  })
})
