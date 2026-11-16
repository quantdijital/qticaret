// A product rail's variants drawn in small for its "Biçim" choice (adr/0049 Ek 2026-11-15),
// in the 112 × 32 box of `variant-sketches.tsx`: plain shapes in the current colour

const Card = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <rect x={x} y={y} width={w} height={h} rx={2} className="fill-current opacity-40" />
)

/** A small side-by-side card: a square photo and two lines. */
const Row = ({ x, y, w }: { x: number; y: number; w: number }) => (
  <>
    <rect x={x} y={y} width={7} height={7} rx={1.5} className="fill-current opacity-45" />
    <rect x={x + 9} y={y + 1} width={w - 9} height={2} rx={1} className="fill-current opacity-55" />
    <rect
      x={x + 9}
      y={y + 4.5}
      width={(w - 9) * 0.6}
      height={1.5}
      rx={0.75}
      className="fill-current opacity-30"
    />
  </>
)

const range = (count: number) => Array.from({ length: count }, (_, index) => index)

/** Today's grid: two rows of four cards. */
export function ShelfGrid() {
  return (
    <>
      {range(8).map((index) => (
        <Card
          key={index}
          x={8 + (index % 4) * 25}
          y={2 + Math.floor(index / 4) * 15}
          w={21}
          h={13}
        />
      ))}
    </>
  )
}

/** One row sliding: four cards and the next one's edge, arrows either side. */
export function ShelfCarousel() {
  return (
    <>
      {range(5).map((index) => (
        <Card key={index} x={10 + index * 22} y={6} w={19} h={20} />
      ))}
      <circle cx={5} cy={16} r={3} className="fill-current opacity-70" />
      <circle cx={107} cy={16} r={3} className="fill-current opacity-70" />
    </>
  )
}

/** One large card beside two rows of three small ones. */
export function ShelfFeatured() {
  return (
    <>
      <Card x={8} y={2} w={36} h={28} />
      {range(6).map((index) => (
        <Card
          key={index}
          x={48 + (index % 3) * 19}
          y={2 + Math.floor(index / 3) * 15}
          w={16}
          h={13}
        />
      ))}
    </>
  )
}

/** Small side-by-side cards three across, three rows. */
export function ShelfCompact() {
  return (
    <>
      {range(9).map((index) => (
        <Row key={index} x={6 + (index % 3) * 35} y={3 + Math.floor(index / 3) * 10} w={31} />
      ))}
    </>
  )
}

/** Three lists side by side, each a heading over small cards. */
export function ShelfColumns() {
  return (
    <>
      {range(3).map((column) => (
        <g key={column}>
          <rect
            x={6 + column * 35}
            y={1}
            width={18}
            height={2.5}
            rx={1}
            className="fill-current opacity-70"
          />
          {range(3).map((index) => (
            <Row key={index} x={6 + column * 35} y={6 + index * 9} w={31} />
          ))}
        </g>
      ))}
    </>
  )
}

/** Five products as slanted strips side by side, a name over each one's foot (Ek 2026-11-16). */
export function ShelfStrips() {
  // Over 8–104 × 2–30: each seam runs 4 across, 2 apart, the outer edges straight
  const run = 4
  const width = (96 - 4 * 2 + 4 * run) / 5
  return (
    <>
      {range(5).map((at) => {
        const left = 8 + at * (width + 2 - run)
        const right = left + width
        const top = at === 0 ? left : left + run
        const foot = at === 4 ? right : right - run
        return (
          <g key={at}>
            <polygon
              points={`${String(top)},2 ${String(right)},2 ${String(foot)},30 ${String(left)},30`}
              className={`fill-current ${at === 1 ? "opacity-60" : "opacity-35"}`}
            />
            <rect
              x={left + 3}
              y={24}
              width={width - run - 6}
              height={2}
              rx={1}
              className="fill-current opacity-80"
            />
          </g>
        )
      })}
    </>
  )
}

/** A place's figure: a heavy upright bar, a narrow "1" in small. */
const Figure = ({ x, y, h }: { x: number; y: number; h: number }) => (
  <rect x={x} y={y} width={h * 0.32} height={h} rx={0.75} className="fill-current opacity-80" />
)

/** A ranked list (Ek 2026-11-16): the first large beside its figure, the rest in rows, each its figure. */
export function ShelfRanked() {
  return (
    <>
      <Figure x={8} y={14} h={16} />
      <Card x={14} y={2} w={26} h={28} />
      {range(4).map((index) => (
        <g key={index}>
          <Figure x={50} y={3 + index * 7.5} h={5} />
          <Row x={54} y={2 + index * 7.5} w={50} />
        </g>
      ))}
    </>
  )
}

/**
 * One product on a dark stage (its photo, its name and price beside it),
 * a list of four rows beside the stage, the stage's own row dark (Ek 2026-11-16).
 */
export function ShelfStage() {
  return (
    <>
      <rect x={8} y={2} width={56} height={28} rx={3} className="fill-current opacity-80" />
      <rect x={11} y={5} width={30} height={22} rx={2} className="fill-background opacity-40" />
      <rect x={45} y={19} width={15} height={2} rx={1} className="fill-background opacity-80" />
      <rect x={45} y={23.5} width={10} height={2} rx={1} className="fill-background opacity-60" />
      <rect x={66} y={1.5} width={40} height={8} rx={1.5} className="fill-current opacity-20" />
      {range(4).map((index) => (
        <Row key={index} x={68} y={3 + index * 7.2} w={34} />
      ))}
    </>
  )
}
