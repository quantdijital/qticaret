// The category section's variants in small for the "Biçim" choice (adr/0049 Ek 2026-11-15)

/** Today's picture tiles: four pictures in a row, a name under each. */
export function CategoriesTiles() {
  return (
    <>
      {[1, 29, 57, 85].map((x) => (
        <g key={x}>
          <rect x={x} y={3} width={26} height={19} rx={3} className="fill-current opacity-40" />
          <rect x={x + 4} y={25} width={16} height={3} rx={1} className="fill-current opacity-60" />
        </g>
      ))}
    </>
  )
}

/**
 * The collage: a wide first card and two narrower ones in one row, each a
 * large photo with its name and a line of links under it.
 */
export function CategoriesCollage() {
  return (
    <>
      {[
        { x: 1, width: 54 },
        { x: 57, width: 26 },
        { x: 85, width: 26 },
      ].map(({ x, width }, index) => (
        <g key={x}>
          <rect x={x} y={2} width={width} height={19} rx={3} className="fill-current opacity-40" />
          <rect
            x={x + 2}
            y={23.5}
            width={index === 0 ? 22 : 15}
            height={3}
            rx={1}
            className="fill-current opacity-70"
          />
          <rect
            x={x + 2}
            y={28}
            width={width - 8}
            height={2}
            rx={1}
            className="fill-current opacity-35"
          />
        </g>
      ))}
    </>
  )
}

/**
 * The panels (Ek 2026-11-19): a tall dark panel on the left, its photo over
 * its name; two wide ones stacked beside it, each name beside its photo.
 */
export function CategoriesPanels() {
  return (
    <>
      <rect x={1} y={1} width={54} height={30} rx={2} className="fill-current opacity-75" />
      <rect x={1} y={1} width={54} height={19} rx={2} className="fill-current opacity-30" />
      <rect x={4} y={23} width={22} height={3} rx={1} className="fill-background opacity-90" />
      <rect
        x={4}
        y={27.5}
        width={30}
        height={1.5}
        rx={0.75}
        className="fill-background opacity-60"
      />
      {[1, 17].map((y) => (
        <g key={y}>
          <rect x={57} y={y} width={54} height={14} rx={2} className="fill-current opacity-75" />
          <rect x={84} y={y} width={27} height={14} rx={2} className="fill-current opacity-30" />
          <rect
            x={60}
            y={y + 7}
            width={15}
            height={2.5}
            rx={1}
            className="fill-background opacity-90"
          />
          <rect
            x={60}
            y={y + 10.5}
            width={20}
            height={1.5}
            rx={0.75}
            className="fill-background opacity-60"
          />
        </g>
      ))}
    </>
  )
}

/** The linked cards: three framed cards, a small picture beside the name and its links. */
export function CategoriesLinked() {
  return (
    <>
      {[1, 38.5, 76].map((x) => (
        <g key={x}>
          <rect
            x={x}
            y={3}
            width={35}
            height={26}
            rx={3}
            className="fill-none stroke-current opacity-50"
          />
          <rect x={x + 3} y={6} width={10} height={10} rx={2} className="fill-current opacity-40" />
          <rect x={x + 16} y={7} width={15} height={3} rx={1} className="fill-current opacity-70" />
          {[13, 18, 23].map((y) => (
            <rect
              key={y}
              x={x + 16}
              y={y}
              width={11}
              height={2}
              rx={1}
              className="fill-current opacity-35"
            />
          ))}
        </g>
      ))}
    </>
  )
}
