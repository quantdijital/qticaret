import type { CSSProperties, ReactNode } from "react"
import type { ThumbColors } from "./thumb-colors"

/**
 * The sketch's blocks (`DesignThumb`), one per kind of home section: a
 * cover in the main colour with its button in the accent, cards, tiles,
 * a dated list, figures, steps, quotes, a band. Each kind drawn its own
 * way, so two looks with other sections, in another order, look apart.
 */

export type Shape =
  | "hero"
  | "slider"
  | "banner"
  | "cards"
  | "tiles"
  | "list"
  | "figures"
  | "steps"
  | "quotes"
  | "band"
  | "search"
  | "collage"
  | "text"

// How much of the page each kind takes, as a share of the room
const WEIGHT: Record<Shape, number> = {
  hero: 7,
  slider: 7,
  banner: 3,
  cards: 4,
  tiles: 3,
  list: 3,
  figures: 2,
  steps: 2,
  quotes: 3,
  band: 1,
  search: 1.5,
  collage: 4,
  text: 2,
}

const line = (color: string, width: string, opacity = 0.35): CSSProperties => ({
  backgroundColor: color,
  width,
  opacity,
})

function Row({ count, grow, render }: { count: number; grow: number; render: () => ReactNode }) {
  return (
    <div className="flex min-h-0 basis-0 gap-[2.5%]" style={{ flexGrow: grow }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex min-w-0 flex-1 flex-col gap-[6%]">
          {render()}
        </div>
      ))}
    </div>
  )
}

export function Block({ shape, colors }: { shape: Shape; colors: ThumbColors }) {
  const grow = WEIGHT[shape]
  const { primary, accent, ink, well } = colors
  switch (shape) {
    case "hero":
    case "slider":
      return (
        <div
          className="relative flex min-h-0 basis-0 flex-col justify-end gap-[5%] overflow-hidden rounded-[2%] p-[4%]"
          style={{
            flexGrow: grow,
            backgroundImage: `linear-gradient(160deg, ${primary}, ${primary}cc 55%, ${ink}e6)`,
          }}
        >
          <span
            className="block h-[9%] max-h-2 rounded-full bg-white/90"
            style={{ width: "42%" }}
          />
          <span
            className="block h-[5%] max-h-1 rounded-full bg-white/55"
            style={{ width: "30%" }}
          />
          <span
            className="mt-[2%] block h-[11%] max-h-2.5 min-h-1 rounded-full"
            style={{ width: "16%", backgroundColor: accent }}
          />
          {shape === "slider" ? (
            <span className="absolute bottom-[6%] left-1/2 flex -translate-x-1/2 gap-[3px]">
              {[0.9, 0.45, 0.45].map((opacity, index) => (
                <span
                  key={index}
                  className="block size-[3px] rounded-full bg-white"
                  style={{ opacity }}
                />
              ))}
            </span>
          ) : null}
        </div>
      )
    case "banner":
      return (
        <div
          className="flex min-h-0 basis-0 items-center gap-[4%] rounded-[2%] px-[4%]"
          style={{ flexGrow: grow, backgroundColor: accent }}
        >
          <span
            className="block h-[14%] max-h-1.5 rounded-full bg-white/85"
            style={{ width: "34%" }}
          />
          <span className="ml-auto block h-[28%] max-h-2.5 w-[12%] rounded-full bg-white/90" />
        </div>
      )
    case "cards":
      return (
        <Row
          count={4}
          grow={grow}
          render={() => (
            <>
              <span className="block flex-[3] rounded-[6%]" style={{ backgroundColor: well }} />
              <span className="block h-[5%] min-h-[2px]" style={line(ink, "80%", 0.45)} />
              <span className="block h-[5%] min-h-[2px]" style={line(primary, "40%", 0.8)} />
            </>
          )}
        />
      )
    case "tiles":
      return (
        <Row
          count={5}
          grow={grow}
          render={() => (
            <>
              <span className="block flex-1 rounded-full" style={{ backgroundColor: well }} />
              <span className="mx-auto block h-[6%] min-h-[2px]" style={line(ink, "60%", 0.4)} />
            </>
          )}
        />
      )
    case "list":
      return (
        <div
          className="flex min-h-0 basis-0 flex-col justify-center gap-[8%]"
          style={{ flexGrow: grow }}
        >
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-[3%]">
              <span className="block h-[3px] w-[8%]" style={{ backgroundColor: primary }} />
              <span className="block h-[2px]" style={line(ink, "46%", 0.35)} />
              <span
                className="ml-auto block h-[4px] w-[10%] rounded-full"
                style={{ backgroundColor: accent }}
              />
            </div>
          ))}
        </div>
      )
    case "figures":
      return (
        <Row
          count={4}
          grow={grow}
          render={() => (
            <>
              <span
                className="mx-auto block h-[30%] min-h-[3px] rounded-sm"
                style={line(primary, "50%", 0.9)}
              />
              <span className="mx-auto block h-[12%] min-h-[2px]" style={line(ink, "70%", 0.3)} />
            </>
          )}
        />
      )
    case "steps":
      return (
        <Row
          count={3}
          grow={grow}
          render={() => (
            <>
              <span
                className="mx-auto block aspect-square h-[45%] rounded-full"
                style={{ backgroundColor: primary, opacity: 0.85 }}
              />
              <span className="mx-auto block h-[10%] min-h-[2px]" style={line(ink, "60%", 0.3)} />
            </>
          )}
        />
      )
    case "quotes":
      return (
        <Row
          count={3}
          grow={grow}
          render={() => (
            <div
              className="flex flex-1 flex-col justify-center gap-[10%] rounded-[6%] border px-[8%]"
              style={{ borderColor: well }}
            >
              <span className="block h-[3px] w-[40%]" style={{ backgroundColor: accent }} />
              <span className="block h-[2px]" style={line(ink, "90%", 0.3)} />
              <span className="block h-[2px]" style={line(ink, "70%", 0.3)} />
            </div>
          )}
        />
      )
    case "band":
      return (
        <div
          className="min-h-[2px] basis-0 rounded-full"
          style={{ flexGrow: grow, backgroundColor: well }}
        />
      )
    case "search":
      return (
        <div
          className="flex min-h-[3px] basis-0 items-stretch justify-center"
          style={{ flexGrow: grow }}
        >
          <span
            className="block w-[50%] rounded-l-full border"
            style={{ borderColor: well, backgroundColor: "white" }}
          />
          <span className="block w-[8%] rounded-r-full" style={{ backgroundColor: primary }} />
        </div>
      )
    case "collage":
      return (
        <div
          className="grid min-h-0 basis-0 grid-cols-3 grid-rows-2 gap-[2%]"
          style={{ flexGrow: grow }}
        >
          <span
            className="col-span-2 row-span-2 block rounded-[4%]"
            style={{ backgroundColor: well }}
          />
          <span className="block rounded-[6%]" style={{ backgroundColor: well }} />
          <span className="block rounded-[6%]" style={{ backgroundColor: well }} />
        </div>
      )
    case "text":
      return (
        <div
          className="flex min-h-0 basis-0 flex-col justify-center gap-[8%]"
          style={{ flexGrow: grow }}
        >
          <span className="block h-[2px]" style={line(ink, "66%", 0.4)} />
          <span className="block h-[2px]" style={line(ink, "50%", 0.25)} />
        </div>
      )
  }
}
