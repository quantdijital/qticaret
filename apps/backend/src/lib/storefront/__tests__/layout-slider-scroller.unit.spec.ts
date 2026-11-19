import path from "node:path"
import { layoutDocument, readStoredLayout } from "../layout"
import { SLIDER_DEFAULTS, SLIDER_SCROLLER, SLIDER_SECONDS } from "../sections/scroller"

// The contract's own files (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT = path.resolve(__dirname, "../../../../../../packages/types/src/store")

const picture = (name: string) => ({ url: `http://localhost:9000/static/${name}.webp`, alt: null })
const slider = (more: Record<string, unknown> = {}) => ({
  id: "kayan0001",
  type: "hero_slider",
  slides: [{ image: picture("bir") }, { image: picture("iki") }],
  ...more,
})
const read = (more: Record<string, unknown>) => readStoredLayout({ home: [slider(more)] }).home[0]
const issues = (more: Record<string, unknown>) =>
  layoutDocument.safeParse({ home: [slider(more)] }).error?.issues.map((each) => each.message) ?? []

describe("the hero slider on the scroller kit (bilesen-denetimi (b) 4)", () => {
  it("reads a slider saved before the kit as it drew: its switches as the kit's steps", () => {
    expect(read({ autoplay: true, interval: 5, dots: false, arrows: false })).toEqual(
      expect.objectContaining({
        scroller: {
          ...SLIDER_DEFAULTS,
          autoplay: "on",
          speed: "fast",
          dots: "off",
          arrows: "hidden",
        },
      })
    )
    const old = read({ autoplay: false, interval: 6, dots: true, arrows: true })
    expect(old).toMatchObject({ scroller: SLIDER_DEFAULTS })
    expect(old).not.toHaveProperty("autoplay")
    expect(old).not.toHaveProperty("interval")
    expect(read({ interval: 8 })).toMatchObject({ scroller: { speed: "slow" } })
  })

  it("keeps seconds no step keeps while they stand for the speed in force", () => {
    expect(read({ autoplay: true, interval: 7 })).toMatchObject({
      scroller: { autoplay: "on", speed: "medium" },
      interval: 7,
    })
    expect(read({ interval: 10 })).toMatchObject({ scroller: { speed: "slow" }, interval: 10 })
    // A save of what was read keeps them; a step the shop picked drops them
    const saved = layoutDocument.parse({ home: [read({ autoplay: true, interval: 9 })] }).home[0]
    expect(saved).toMatchObject({ scroller: { speed: "slow" }, interval: 9 })
    const picked = layoutDocument.parse({
      home: [slider({ scroller: { ...SLIDER_DEFAULTS, speed: "fast" }, interval: 9 })],
    }).home[0]
    expect(picked).not.toHaveProperty("interval")
  })

  it("lets the kit's settings win over switches sent beside them", () => {
    expect(read({ scroller: { dots: "off" }, dots: true, arrows: false })).toMatchObject({
      scroller: { ...SLIDER_DEFAULTS, dots: "off" },
    })
  })

  it("refuses a step off its list and a kit setting a slider has no use for", () => {
    expect(issues({ scroller: { arrows: "sometimes" } })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ scroller: { loop: true } })).toEqual(["storefront_layout.section_invalid"])
    expect(issues({ scroller: { desktop: "four" } })).not.toEqual([])
  })

  it("keeps the controls' own steps, today's look where none is saved, and refuses one off the list", () => {
    const controls = {
      play_button: "off",
      dot_style: "progress",
      controls_place: "end",
      arrow_size: "large",
      controls_tone: "brand",
    }
    expect(read({ scroller: controls })).toMatchObject({
      scroller: { ...SLIDER_DEFAULTS, ...controls },
    })
    expect(read({ scroller: { dots: "off" } })).toMatchObject({
      scroller: {
        play_button: "on",
        dot_style: "dots",
        controls_place: "center",
        arrow_size: "medium",
        controls_tone: "dark",
      },
    })
    expect(issues({ scroller: { dot_style: "stars" } })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ scroller: { controls_tone: "#ff0000" } })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("mirrors the contract's slider settings: a step goes there first", () => {
    const scroller = jest.requireActual<Record<string, unknown>>(`${CONTRACT}/section-scroller.ts`)
    expect(SLIDER_SCROLLER).toEqual(scroller["SLIDER_SCROLLER"])
    expect(SLIDER_DEFAULTS).toEqual(scroller["SLIDER_DEFAULTS"])
    expect(SLIDER_SECONDS).toEqual(scroller["SLIDER_SECONDS"])
  })
})
