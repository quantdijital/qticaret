import type { Grade } from "@/features/seo/api/advisor"

import { cn } from "@qticaret/admin-ui/lib/utils"

const TONE: Record<Grade, string> = {
  excellent: "text-success",
  good: "text-info",
  needs_work: "text-warning",
  poor: "text-destructive",
}

/** The score as a ring filled to its value, coloured by grade; the number says it in words too. */
export function ScoreRing({
  score,
  grade,
  size = 64,
  label,
}: {
  score: number
  grade: Grade
  size?: number
  label: string
}) {
  const stroke = Math.max(4, Math.round(size / 11))
  const radius = (size - stroke) / 2
  const length = 2 * Math.PI * radius
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${String(size)} ${String(size)}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          className={cn("transition-[stroke-dashoffset]", TONE[grade])}
          strokeDasharray={length}
          strokeDashoffset={length * (1 - score / 100)}
          transform={`rotate(-90 ${String(size / 2)} ${String(size / 2)})`}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums"
        style={{ fontSize: Math.round(size / 3.2) }}
      >
        {score}
      </span>
    </div>
  )
}
