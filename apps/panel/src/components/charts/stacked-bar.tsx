import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatCount, formatPercent } from "@/lib/format"

export interface Segment {
  key: string
  label: string
  value: number
  /** A CSS colour or variable (an ordinal ramp step, a quiet grey). */
  color: string
}

/**
 * Part of a whole as one bar (dataviz: stacked bar, 2px surface gap
 * between segments), with a legend that names each part and carries its
 * count and share, so colour never carries it alone.
 */
export function StackedBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const shown = segments.filter((segment) => segment.value > 0)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
        {shown.map((segment) => (
          <Tooltip key={segment.key}>
            <TooltipTrigger asChild>
              {/* A labelled part a keyboard can reach for its tooltip: an image, to assistive tech */}
              <div
                role="img"
                tabIndex={0}
                aria-label={`${segment.label}: ${formatCount(segment.value)}`}
                className="h-full outline-none transition-opacity first:rounded-l-full last:rounded-r-full hover:opacity-85 focus-visible:opacity-85"
                style={{
                  width: `${String((segment.value / total) * 100)}%`,
                  background: segment.color,
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {segment.label}: {formatCount(segment.value)} ({formatPercent(segment.value / total)})
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <ul className="flex flex-col gap-2.5">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: segment.color }}
            />
            <span className="min-w-0 flex-1 truncate">{segment.label}</span>
            <span className="tabular font-medium">{formatCount(segment.value)}</span>
            <span className="tabular w-11 text-right text-muted-foreground">
              {total > 0 ? formatPercent(segment.value / total) : "–"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
