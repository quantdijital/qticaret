// The posts' and the picture band's variants in small (adr/0077 Ek), for the
// "Biçim" choice: a plain sketch in the current colour, 112 by 32

/** A card: its picture over a title line. */
const Card = ({ x, w }: { x: number; w: number }) => (
  <>
    <rect x={x} y={6} width={w} height={20} rx={2} className="fill-current opacity-20" />
    <rect x={x} y={6} width={w} height={12} rx={2} className="fill-current opacity-45" />
    <rect x={x + 2} y={21} width={w - 8} height={2} rx={1} className="fill-current opacity-70" />
  </>
)

/** Today's posts: three tiles under the heading. */
export function PostsGrid() {
  return (
    <>
      <rect x={1} y={0} width={30} height={3} rx={1} className="fill-current opacity-80" />
      <g transform="translate(0 4)">
        <Card x={1} w={34} />
        <Card x={39} w={34} />
        <Card x={77} w={34} />
      </g>
    </>
  )
}

/** "Tanıtım paneli": one tinted panel, the words and a button beside two cards. */
export function PostsIntroPanel() {
  return (
    <>
      <rect x={1} y={1} width={110} height={30} rx={4} className="fill-current opacity-15" />
      <rect x={6} y={7} width={14} height={2} rx={1} className="fill-current opacity-45" />
      <rect x={6} y={11} width={30} height={4} rx={1} className="fill-current opacity-80" />
      <rect x={6} y={17} width={26} height={2} rx={1} className="fill-current opacity-45" />
      <rect x={6} y={22} width={16} height={5} rx={2} className="fill-current opacity-70" />
      <Card x={46} w={28} />
      <Card x={78} w={28} />
    </>
  )
}

/** Today's band: the picture with its words over it. */
export function BannerStandard() {
  return (
    <>
      <rect x={1} y={2} width={110} height={28} rx={4} className="fill-current opacity-45" />
      <rect x={8} y={17} width={36} height={4} rx={1} className="fill-current opacity-90" />
      <rect x={8} y={23} width={18} height={4} rx={2} className="fill-current opacity-90" />
    </>
  )
}

/** "Bölünmüş bant": the picture beside a dark panel with the words and a button. */
export function BannerSplit() {
  return (
    <>
      <rect x={1} y={2} width={110} height={28} rx={4} className="fill-current opacity-80" />
      <path
        d="M5 2 H50 Q60 16 50 30 H5 A4 4 0 0 1 1 26 V6 A4 4 0 0 1 5 2 Z"
        className="fill-current opacity-35"
      />
      <rect x={66} y={8} width={14} height={2} rx={1} className="fill-current opacity-40" />
      <rect x={66} y={12} width={34} height={4} rx={1} className="fill-current opacity-15" />
      <rect x={66} y={21} width={18} height={5} rx={2} className="fill-current opacity-40" />
    </>
  )
}
