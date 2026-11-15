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
