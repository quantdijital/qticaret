import { AlignCenter, AlignLeft, AlignRight, MonitorSmartphone } from "lucide-react"
import type { AnnouncementStep } from "@qticaret/types"

// The announcement bar's place and size drawn in small (the plan's rule:
// options told with pictures, not words alone), in the current colour

const ALIGN = {
  auto: MonitorSmartphone,
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
} as const

/** Where the lines sit: "Otomatik" as the screen decides, else the line's side. */
export function AlignSketch({ step }: { step: AnnouncementStep<"align"> }) {
  const Icon = ALIGN[step]
  return <Icon aria-hidden="true" className="size-4" />
}

const BAR = { small: 6, medium: 9, large: 13 } as const

/** The bar's size: a thin, a medium and a tall band, each with its line of words. */
export function SizeSketch({ step }: { step: AnnouncementStep<"size"> }) {
  const height = BAR[step]
  const top = (16 - height) / 2
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
      <rect x={1} y={top} width={22} height={height} rx={1.5} className="fill-current opacity-30" />
      <rect
        x={6}
        y={8 - height / 8}
        width={12}
        height={height / 4}
        rx={0.5}
        className="fill-current"
      />
    </svg>
  )
}
