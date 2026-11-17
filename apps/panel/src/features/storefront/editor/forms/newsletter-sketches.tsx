// The newsletter box's variants in small (adr/0049 Ek 2026-11-17 e-bülten), for the
// "Biçim" choice: a plain sketch in the current colour, 112 by 32

/** A heading bar and a shorter line under it. */
const Words = ({ x, y, w }: { x: number; y: number; w: number }) => (
  <>
    <rect x={x} y={y} width={w} height={3} rx={1} className="fill-current opacity-80" />
    <rect x={x} y={y + 6} width={w * 0.75} height={2} rx={1} className="fill-current opacity-45" />
  </>
)

/** A field and its button in one piece. */
const Joined = ({ x, y, w, h = 7 }: { x: number; y: number; w: number; h?: number }) => (
  <>
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={1.5}
      className="fill-none stroke-current opacity-50"
    />
    <rect x={x + w * 0.68} y={y} width={w * 0.32} height={h} rx={1.5} className="fill-current" />
  </>
)

/** Today's box: the heading left, a stacked form right on a tinted well. */
export function NewsletterStandard() {
  return (
    <>
      <rect x={1} y={2} width={110} height={28} rx={4} className="fill-current opacity-15" />
      <rect x={7} y={8} width={34} height={4} rx={1} className="fill-current opacity-80" />
      <rect x={58} y={7} width={36} height={6} rx={3} className="fill-none stroke-current" />
      <rect x={96} y={7} width={10} height={6} rx={3} className="fill-current" />
      <rect x={58} y={17} width={4} height={4} rx={1} className="fill-none stroke-current" />
      <rect x={64} y={18} width={40} height={2} rx={1} className="fill-current opacity-45" />
    </>
  )
}

/** A low band: words and a promise left, one joined form right. */
export function NewsletterSplit() {
  return (
    <>
      <rect x={1} y={5} width={110} height={22} rx={4} className="fill-current opacity-15" />
      <Words x={7} y={10} w={36} />
      <rect x={7} y={20} width={22} height={1.5} rx={0.75} className="fill-current opacity-35" />
      <Joined x={60} y={12} w={45} />
    </>
  )
}

/** A picture beside the words and the form. */
export function NewsletterImageCard() {
  return (
    <>
      <rect x={1} y={2} width={110} height={28} rx={4} className="fill-current opacity-15" />
      <rect x={1} y={2} width={40} height={28} rx={4} className="fill-current opacity-45" />
      <Words x={48} y={8} w={36} />
      <Joined x={48} y={20} w={50} h={6} />
    </>
  )
}

/** One thin row: an envelope, the heading, a small form at its end. */
export function NewsletterStrip() {
  return (
    <>
      <rect x={1} y={10} width={110} height={12} rx={3} className="fill-current opacity-15" />
      <rect x={6} y={13.5} width={7} height={5} rx={1} className="fill-none stroke-current" />
      <rect x={17} y={14.5} width={30} height={3} rx={1} className="fill-current opacity-80" />
      <rect x={50} y={15} width={18} height={2} rx={1} className="fill-current opacity-45" />
      <Joined x={74} y={13} w={33} h={6} />
    </>
  )
}

/** Small in the footer's brand column, beside the link columns. */
export function NewsletterInFooter() {
  return (
    <>
      <rect x={1} y={2} width={110} height={28} rx={3} className="fill-current opacity-10" />
      <rect x={6} y={6} width={20} height={4} rx={1} className="fill-current opacity-80" />
      <rect x={6} y={14} width={24} height={2} rx={1} className="fill-current opacity-60" />
      <Joined x={6} y={19} w={30} h={6} />
      {[48, 70, 92].map((x) => (
        <g key={x}>
          <rect x={x} y={7} width={14} height={2} rx={1} className="fill-current opacity-60" />
          <rect
            x={x}
            y={13}
            width={12}
            height={1.5}
            rx={0.75}
            className="fill-current opacity-35"
          />
          <rect
            x={x}
            y={18}
            width={10}
            height={1.5}
            rx={0.75}
            className="fill-current opacity-35"
          />
        </g>
      ))}
    </>
  )
}
