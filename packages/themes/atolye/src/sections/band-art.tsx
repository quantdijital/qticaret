/** One lily petal pointing up from the flower's heart, drawn at the origin. */
const PETAL = "M0 0C-8-13-8-30 0-44C8-30 8-13 0 0Z"

/** A long leaf from its foot at the origin, pointing up. */
const LEAF = "M0 0C-11-20-10-46 0-68C10-46 11-20 0 0Z"

function Lily({ x, y, scale, turn }: { x: number; y: number; scale: number; turn: number }) {
  return (
    <g
      transform={`translate(${String(x)} ${String(y)}) scale(${String(scale)}) rotate(${String(turn)})`}
    >
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <path
          key={angle}
          className="gf-band-petal"
          d={PETAL}
          transform={`rotate(${String(angle)})`}
        />
      ))}
      {[30, 90, 150, 210, 270, 330].map((angle) => (
        <path
          key={angle}
          className="gf-band-stamen"
          d="M0 0L0-20"
          transform={`rotate(${String(angle)})`}
        />
      ))}
      <circle className="gf-band-heart" r="4" />
    </g>
  )
}

/**
 * The split band's flower spray (`ornament: flower`): two lilies in the
 * shop's accent colour over long leaves and two pale fronds in tints of
 * its main colour (`split.css`), at the panel's lower right, leaning out
 * past the band's edge from 1024 px. For the eye only.
 */
export function BandFlower() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 220 190"
      className="gf-band-flower pointer-events-none absolute -right-8 -bottom-7 hidden h-48 w-56 lg:block"
    >
      <g className="gf-band-frond" fill="none" strokeWidth="1.5" strokeLinecap="round">
        <path d="M40 182C52 150 70 128 100 112" />
        <path d="M52 158l-10-8M60 146l-12-5M70 135l-11-3M82 125l-9-1M58 153l4-12M68 141l5-11M79 131l6-9" />
        <path d="M170 184C176 160 190 140 214 128" />
        <path d="M178 164l-9-6M184 152l-9-3M192 142l-8-1M183 159l6-10M190 148l6-8" />
      </g>
      <g className="gf-band-leaf">
        <path d={LEAF} transform="translate(130 182) rotate(-38)" />
        <path d={LEAF} transform="translate(136 184) rotate(-8) scale(1.1)" />
        <path d={LEAF} transform="translate(142 184) rotate(26)" />
        <path d={LEAF} transform="translate(120 186) rotate(-64) scale(0.8)" />
        <path d={LEAF} transform="translate(150 186) rotate(58) scale(0.75)" />
      </g>
      <Lily x={146} y={88} scale={1.05} turn={8} />
      <Lily x={78} y={130} scale={0.62} turn={-12} />
    </svg>
  )
}

/**
 * The posts' intro panel's leaf sprig (`ornament: leaves`): a stem and
 * five leaves in a soft tint of the main colour (`split.css`), at the
 * panel's lower right, leaning past its corner from 1024 px. For the eye only.
 */
export function PanelLeaves() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 90 120"
      className="gf-panel-leaves pointer-events-none absolute -right-4 -bottom-5 hidden h-28 w-20 lg:block"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M20 118C34 92 46 64 72 10" />
      </g>
      <g fill="currentColor">
        <path d={LEAF} transform="translate(66 22) rotate(40) scale(0.42)" />
        <path d={LEAF} transform="translate(56 44) rotate(-30) scale(0.5)" />
        <path d={LEAF} transform="translate(58 48) rotate(62) scale(0.48)" />
        <path d={LEAF} transform="translate(42 72) rotate(-44) scale(0.55)" />
        <path d={LEAF} transform="translate(46 76) rotate(56) scale(0.5)" />
        <path d={LEAF} transform="translate(30 98) rotate(-50) scale(0.45)" />
      </g>
    </svg>
  )
}
