import type { ReactElement } from "react"
import type { SectionVariant, VariantSectionType } from "@qticaret/types"

// Each variant drawn in small for the "Biçim" choice (adr/0049 Ek 2026-11-14 §2.6):
// a plain sketch in the current colour, not a picture of the storefront

const Badge = ({ x, y }: { x: number; y: number }) => (
  <>
    <circle cx={x + 4} cy={y + 4} r={3} className="fill-current opacity-60" />
    <rect x={x + 10} y={y + 1.5} width={12} height={2} rx={1} className="fill-current opacity-60" />
    <rect
      x={x + 10}
      y={y + 5}
      width={8}
      height={1.5}
      rx={0.75}
      className="fill-current opacity-35"
    />
  </>
)

const FOUR = [4, 31, 58, 85]

/** Today's strip: four badges on one tinted band. */
function TrustStrip() {
  return (
    <>
      <rect x={1} y={6} width={110} height={20} rx={4} className="fill-current opacity-15" />
      {FOUR.map((x) => (
        <Badge key={x} x={x} y={12} />
      ))}
    </>
  )
}

/** GB4: four boxes in one frame, split by hairlines. */
function TrustLined() {
  return (
    <>
      <rect
        x={1}
        y={6}
        width={110}
        height={20}
        rx={2}
        className="fill-none stroke-current opacity-50"
      />
      {[28.5, 56, 83.5].map((x) => (
        <line key={x} x1={x} y1={6} x2={x} y2={26} className="stroke-current opacity-50" />
      ))}
      {FOUR.map((x) => (
        <Badge key={x} x={x} y={12} />
      ))}
    </>
  )
}

const SKETCHES: {
  readonly [T in VariantSectionType]: Readonly<Record<SectionVariant<T>, () => ReactElement>>
} = {
  trust_badges: { strip: TrustStrip, lined: TrustLined },
}

/** A variant in small, in the current colour; a variant without a sketch yet draws nothing. */
export function VariantSketch<T extends VariantSectionType>({
  type,
  variant,
}: {
  type: T
  variant: SectionVariant<T>
}) {
  const sketches: Readonly<Record<string, (() => ReactElement) | undefined>> = SKETCHES[type]
  const Sketch = sketches[variant]
  return Sketch ? (
    <svg aria-hidden="true" viewBox="0 0 112 32" className="h-8 w-full max-w-28">
      <Sketch />
    </svg>
  ) : null
}
