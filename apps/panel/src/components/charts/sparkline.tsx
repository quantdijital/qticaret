import { useId } from "react"
import { Area, AreaChart } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

const config = { value: { label: "value", color: "var(--chart-1)" } }

/**
 * A stat tile's trend (dataviz): no axes, no tooltip, the shape only; the
 * tile's number and delta carry the values.
 */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const gradientId = `spark-${useId().replace(/:/g, "")}`
  const data = values.map((value, index) => ({ index, value }))
  return (
    <ChartContainer
      config={config}
      aria-hidden="true"
      className={cn("aspect-auto h-10 w-full", className)}
    >
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
