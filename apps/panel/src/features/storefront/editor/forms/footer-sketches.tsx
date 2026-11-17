// The footer's variants in small for the "Biçim" choice (adr/0049 Ek 2026-11-17),
// each in the same frame, so the two read as two choices of the same thing

const Frame = () => (
  <rect
    data-sketch-frame=""
    x={1}
    y={3}
    width={110}
    height={26}
    rx={3}
    className="fill-current opacity-15"
  />
)

/** A column of three short links. */
const Links = ({ x, y }: { x: number; y: number }) => (
  <>
    {[0, 3.5, 7].map((step) => (
      <rect
        key={step}
        x={x}
        y={y + step}
        width={step === 0 ? 12 : 10}
        height={1.5}
        rx={0.75}
        className={`fill-current ${step === 0 ? "opacity-70" : "opacity-40"}`}
      />
    ))}
  </>
)

/** Today's ledger: the contact on the left, the menus on the right, a band of marks and a muted line. */
export function FooterLedger() {
  return (
    <>
      <Frame />
      <rect x={6} y={7} width={18} height={3} rx={1} className="fill-current opacity-70" />
      <rect x={6} y={12} width={22} height={1.5} rx={0.75} className="fill-current opacity-40" />
      <rect x={6} y={15.5} width={16} height={1.5} rx={0.75} className="fill-current opacity-40" />
      <Links x={48} y={7} />
      <Links x={68} y={7} />
      <Links x={88} y={7} />
      <line x1={6} y1={21} x2={106} y2={21} className="stroke-current opacity-30" />
      <rect x={6} y={24} width={40} height={1.5} rx={0.75} className="fill-current opacity-35" />
    </>
  )
}

/**
 * Brand and columns: a strip with the newsletter field above, the brand
 * block beside four columns, one bottom line with the marks on cards in
 * its middle.
 */
export function FooterBrandColumns() {
  return (
    <>
      <Frame />
      <rect x={1} y={3} width={110} height={6} rx={3} className="fill-current opacity-15" />
      <rect x={6} y={5.25} width={20} height={1.5} rx={0.75} className="fill-current opacity-60" />
      <rect
        x={30}
        y={4.5}
        width={26}
        height={3}
        rx={1.5}
        className="fill-none stroke-current opacity-50"
      />
      <circle cx={80} cy={6} r={1.5} className="fill-current opacity-60" />
      <circle cx={94} cy={6} r={1.5} className="fill-current opacity-60" />
      <rect x={6} y={12} width={16} height={3} rx={1} className="fill-current opacity-70" />
      <rect x={6} y={17} width={24} height={1.5} rx={0.75} className="fill-current opacity-40" />
      <Links x={40} y={12} />
      <Links x={57} y={12} />
      <Links x={74} y={12} />
      <Links x={91} y={12} />
      <line x1={6} y1={23} x2={106} y2={23} className="stroke-current opacity-30" />
      <rect x={6} y={25} width={14} height={1.5} rx={0.75} className="fill-current opacity-35" />
      {[44, 51, 58, 65].map((x) => (
        <rect
          key={x}
          x={x}
          y={24.25}
          width={5.5}
          height={3.5}
          rx={0.75}
          className="fill-background stroke-current opacity-70"
        />
      ))}
      <rect x={92} y={25} width={14} height={1.5} rx={0.75} className="fill-current opacity-35" />
    </>
  )
}

/**
 * Free rows (adr/0070): the shop's own rows, each split into columns of
 * its choosing, above the fixed bottom line.
 */
export function FooterFreeRows() {
  return (
    <>
      <Frame />
      <rect x={6} y={6} width={48} height={5} rx={1} className="fill-current opacity-40" />
      <rect x={58} y={6} width={48} height={5} rx={1} className="fill-current opacity-40" />
      <rect x={6} y={13} width={38} height={8} rx={1} className="fill-current opacity-55" />
      <rect x={48} y={13} width={17} height={8} rx={1} className="fill-current opacity-40" />
      <rect x={69} y={13} width={17} height={8} rx={1} className="fill-current opacity-40" />
      <rect x={90} y={13} width={16} height={8} rx={1} className="fill-current opacity-40" />
      <line x1={6} y1={23.5} x2={106} y2={23.5} className="stroke-current opacity-30" />
      <rect x={6} y={25} width={14} height={1.5} rx={0.75} className="fill-current opacity-35" />
      <rect x={92} y={25} width={14} height={1.5} rx={0.75} className="fill-current opacity-35" />
    </>
  )
}
