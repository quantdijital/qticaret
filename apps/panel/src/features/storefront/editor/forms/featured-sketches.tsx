import type { FeaturedProductStep } from "@qticaret/types"

/**
 * The featured product's settings drawn in small, in the current colour
 * (adr/0049 Ek 2026-11-15, 2026-11-16): the photographs' layout, where the
 * strips stand, how steep their seams run and the line between them.
 */

const SKETCH = "h-4 w-6"

/** Three strips over `x0`–`x1`, `y0`–`y1`: each seam run by `run`, apart by `gap`, the outer edges straight. */
function strips(x0: number, x1: number, y0: number, y1: number, run: number, gap: number) {
  const width = (x1 - x0 - 2 * gap + 2 * run) / 3
  return [0, 1, 2].map((at) => {
    const left = x0 + at * (width + gap - run)
    const right = left + width
    const topLeft = at === 0 ? left : left + run
    const bottomRight = at === 2 ? right : right - run
    return `${String(topLeft)},${String(y0)} ${String(right)},${String(y0)} ${String(bottomRight)},${String(y1)} ${String(left)},${String(y1)}`
  })
}

function Strips({ points }: { points: string[] }) {
  return (
    <>
      {points.map((each, at) => (
        <polygon
          key={each}
          points={each}
          className={`fill-current ${at === 1 ? "opacity-60" : "opacity-30"}`}
        />
      ))}
    </>
  )
}

/** The photographs' layouts: the collage, the slanted strips. */
export function GallerySketch({ step }: { step: FeaturedProductStep<"gallery"> }) {
  return (
    <svg viewBox="0 0 24 16" className={SKETCH} aria-hidden="true">
      {step === "collage" ? (
        <>
          <rect x={1} y={1} width={15} height={14} rx={1.5} className="fill-current opacity-60" />
          <rect
            x={17.5}
            y={1}
            width={5.5}
            height={6.5}
            rx={1}
            className="fill-current opacity-30"
          />
          <rect
            x={17.5}
            y={8.5}
            width={5.5}
            height={6.5}
            rx={1}
            className="fill-current opacity-30"
          />
        </>
      ) : (
        <>
          <polygon points="1,1 9,1 7,15 1,15" className="fill-current opacity-60" />
          <polygon points="10.5,1 16.5,1 14.5,15 8.5,15" className="fill-current opacity-30" />
          <polygon points="18,1 23,1 23,15 16,15" className="fill-current opacity-30" />
        </>
      )}
    </svg>
  )
}

/** Where the strips stand: beside the words, or across the stage over them. */
export function LayoutSketch({ step }: { step: FeaturedProductStep<"strips_layout"> }) {
  return (
    <svg viewBox="0 0 24 16" className={SKETCH} aria-hidden="true">
      {step === "side" ? (
        <>
          <Strips points={strips(1, 14, 1, 15, 1.5, 0.8)} />
          <rect x={16} y={5} width={7} height={1.5} rx={0.75} className="fill-current opacity-60" />
          <rect
            x={16}
            y={8.5}
            width={5}
            height={1.2}
            rx={0.6}
            className="fill-current opacity-30"
          />
        </>
      ) : (
        <>
          <Strips points={strips(1, 23, 1, 10, 1.5, 0.8)} />
          <rect x={1} y={12} width={8} height={1.5} rx={0.75} className="fill-current opacity-60" />
          <rect
            x={15}
            y={12}
            width={8}
            height={1.5}
            rx={0.75}
            className="fill-current opacity-30"
          />
        </>
      )}
    </svg>
  )
}

const RUN: Readonly<Record<FeaturedProductStep<"strips_slant">, number>> = {
  soft: 1,
  medium: 2.5,
  steep: 4.5,
}

/** How steep the seams run. */
export function SlantSketch({ step }: { step: FeaturedProductStep<"strips_slant"> }) {
  return (
    <svg viewBox="0 0 24 16" className={SKETCH} aria-hidden="true">
      <Strips points={strips(1, 23, 1, 15, RUN[step], 1)} />
    </svg>
  )
}

const GAP: Readonly<Record<FeaturedProductStep<"strips_line">, number>> = {
  none: 0,
  thin: 0.6,
  medium: 1.4,
  thick: 2.4,
}

/** The line between two strips. */
export function LineSketch({ step }: { step: FeaturedProductStep<"strips_line"> }) {
  return (
    <svg viewBox="0 0 24 16" className={SKETCH} aria-hidden="true">
      <Strips points={strips(1, 23, 1, 15, 2.5, GAP[step])} />
    </svg>
  )
}
