// The FAQ's variants in small (adr/0073 Ek 2026-11-24 (2)), for the "Biçim" choice:
// a plain sketch in the current colour, 112 by 32

/** A closed question: a rounded bar with its plus. */
const Question = ({ x, y, w }: { x: number; y: number; w: number }) => (
  <>
    <rect x={x} y={y} width={w} height={6} rx={2} className="fill-current opacity-20" />
    <rect
      x={x + 3}
      y={y + 2}
      width={w * 0.5}
      height={2}
      rx={1}
      className="fill-current opacity-60"
    />
    <rect x={x + w - 6} y={y + 2} width={3} height={2} rx={1} className="fill-current opacity-60" />
  </>
)

/** Today's: the heading on the left, the questions on the right. */
export function FaqStandard() {
  return (
    <>
      <rect x={4} y={6} width={30} height={4} rx={1} className="fill-current opacity-80" />
      <Question x={44} y={4} w={64} />
      <Question x={44} y={13} w={64} />
      <Question x={44} y={22} w={64} />
    </>
  )
}

/** "Sayfa SSS'si": the topics and the help box on the left, the groups' questions on the right. */
export function FaqPage() {
  return (
    <>
      <rect x={4} y={4} width={18} height={3} rx={1.5} className="fill-current opacity-45" />
      <rect x={4} y={9} width={14} height={3} rx={1.5} className="fill-current opacity-45" />
      <rect x={4} y={17} width={30} height={12} rx={2} className="fill-current opacity-15" />
      <rect x={44} y={2} width={26} height={3} rx={1} className="fill-current opacity-80" />
      <Question x={44} y={7} w={64} />
      <rect x={44} y={16} width={22} height={3} rx={1} className="fill-current opacity-80" />
      <Question x={44} y={21} w={64} />
    </>
  )
}
