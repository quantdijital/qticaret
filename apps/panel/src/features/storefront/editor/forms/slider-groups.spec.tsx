import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { SLIDER_DEFAULTS } from "@qticaret/types"
import "@/lib/i18n"
import type { AnySection, HeroSliderSection } from "@/features/storefront/api/layout"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { SectionPanel } from "../section-panel"
import { FIELD_IDS } from "./field-registry"
import { withSliderKit } from "./slider-kit"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin: {} } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const picture = (name: string) => ({ image: { url: `/static/${name}.webp`, alt: null } })
const start = (over: Partial<HeroSliderSection> = {}): HeroSliderSection => ({
  ...(newHomeSection("hero_slider", "kayangiris") as HeroSliderSection),
  slides: ["bir", "iki"].map((name) => ({
    ...picture(name),
    mobile_image: null,
    heading: null,
    text: null,
    link: null,
    position: "left" as const,
    tone: "light" as const,
  })),
  ...over,
})

/** The slider's panel as the editor holds it: every change kept. */
function renderPanel(section: HeroSliderSection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState<AnySection>(section)
    return (
      <SectionPanel
        section={value}
        group="home"
        problems={{}}
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

const box = (id: string) => {
  const found = document.getElementById(id)
  if (!found) throw new Error(`${id} is not drawn`)
  return within(found)
}

describe("the hero slider's kit settings (bilesen-denetimi (b) 4)", () => {
  it("opens Kaydırma with turning, arrows and dots; the speed once it turns by itself", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(start())
    expect(screen.getByRole("button", { name: "Kaydırma" })).toBeVisible()
    const autoplay = box(FIELD_IDS.scroller("kayangiris", "autoplay")).getByRole("switch")
    expect(autoplay).not.toBeChecked()
    expect(box(FIELD_IDS.scroller("kayangiris", "dots")).getByRole("switch")).toBeChecked()
    expect(document.getElementById(FIELD_IDS.scroller("kayangiris", "speed"))).toBeNull()
    // Not offered on a slider: cards in view, the arrows' place, dragging
    expect(document.getElementById(FIELD_IDS.scroller("kayangiris", "desktop"))).toBeNull()
    expect(document.getElementById(FIELD_IDS.scroller("kayangiris", "arrow_position"))).toBeNull()

    await user.click(autoplay)
    expect(changes.at(-1)).toMatchObject({ scroller: { ...SLIDER_DEFAULTS, autoplay: "on" } })
    await user.click(
      box(FIELD_IDS.scroller("kayangiris", "speed")).getByRole("radio", { name: "Yavaş" })
    )
    expect(changes.at(-1)).toMatchObject({ scroller: { speed: "slow" } })
    expect(changes.at(-1)).not.toHaveProperty("desktop")
  })

  it("drops the switches from before the kit, and their seconds once another speed is picked", () => {
    const old = start({ autoplay: true, interval: 7, dots: true })
    delete old.scroller
    const kept = withSliderKit(old, {
      ...SLIDER_DEFAULTS,
      autoplay: "on",
      speed: "medium",
    } as never)
    expect(kept).toMatchObject({ scroller: { autoplay: "on", speed: "medium" }, interval: 7 })
    expect(kept).not.toHaveProperty("autoplay")
    expect(kept).not.toHaveProperty("dots")
    const picked = withSliderKit(old, {
      ...SLIDER_DEFAULTS,
      autoplay: "on",
      speed: "fast",
    } as never)
    expect(picked).not.toHaveProperty("interval")
  })
})
