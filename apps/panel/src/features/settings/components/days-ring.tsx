import { cn } from "@qticaret/admin-ui/lib/utils"

export type RingTone = "info" | "success" | "warning" | "danger"

const TONE: Record<RingTone, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
}

const SIZE = 104
const STROKE = 9

/**
 * A countdown as a ring (the SEO score ring's drawing): the days in the
 * middle, a word under them, the arc filled to `share` (0–1). The whole
 * thing is one image named by `label`.
 */
export function DaysRing({
  days,
  unit,
  caption,
  share,
  tone,
  label,
}: {
  days: number
  unit: string
  caption: string
  share: number
  tone: RingTone
  label: string
}) {
  const radius = (SIZE - STROKE) / 2
  const length = 2 * Math.PI * radius
  const centre = SIZE / 2
  return (
    <div role="img" aria-label={label} className="relative size-[104px] shrink-0">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${String(SIZE)} ${String(SIZE)}`}
        aria-hidden="true"
      >
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
        />
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          stroke="currentColor"
          className={cn("transition-[stroke-dashoffset]", TONE[tone])}
          strokeDasharray={length}
          strokeDashoffset={length * (1 - share)}
          transform={`rotate(-90 ${String(centre)} ${String(centre)})`}
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center leading-none"
      >
        <span className="text-[28px] font-semibold tracking-[-0.02em] tabular-nums">{days}</span>
        <span className="mt-1 text-[11px] font-medium text-muted-foreground">{unit}</span>
        <span className="mt-0.5 text-[11px] text-muted-foreground">{caption}</span>
      </span>
    </div>
  )
}
