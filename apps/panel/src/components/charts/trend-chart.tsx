import { useId } from "react"
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

export interface TrendPoint {
  /** The bucket as the axis and tooltip show it. */
  label: string
  current: number
  previous: number
}

interface TrendChartProps {
  data: TrendPoint[]
  currentLabel: string
  previousLabel: string
  /** Full value for the tooltip (₺1.250,80) and compact one for the axis (₺1,3 B). */
  formatValue: (value: number) => string
  formatTick: (value: number) => string
  tableCaption: string
  className?: string
}

// Recharts reads colours from the config as CSS variables (--color-<key>)
const config = {
  current: { label: "current", color: "var(--chart-1)" },
  previous: { label: "previous", color: "var(--chart-muted)" },
} satisfies ChartConfig

interface TooltipRow {
  dataKey?: unknown
  value?: unknown
}

function TrendTooltip({
  active,
  payload,
  label,
  formatValue,
  names,
}: {
  active?: boolean | undefined
  payload?: readonly TooltipRow[] | undefined
  label?: string | number | undefined
  formatValue: (value: number) => string
  names: Record<string, string>
}) {
  if (!active || !payload?.length) {
    return null
  }
  return (
    <div className="min-w-44 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-overlay">
      <p className="mb-1.5 text-xs text-muted-foreground">{label ?? ""}</p>
      <ul className="flex flex-col gap-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center gap-2 text-xs">
            {/* dataviz: tooltip rows key their series with a short stroke */}
            <span
              aria-hidden="true"
              className="h-0.5 w-3 rounded-full"
              style={{ background: `var(--color-${String(entry.dataKey)})` }}
            />
            <span className="text-muted-foreground">{names[String(entry.dataKey)]}</span>
            <span className="tabular ml-auto pl-4 text-sm font-semibold text-foreground">
              {formatValue(Number(entry.value))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * One series over time against the previous period (dataviz: emphasis):
 * the current period in the brand colour with a soft wash, the previous one
 * as a quiet grey line; one axis, hairline grid, a crosshair tooltip that
 * lists both. A table carries the same numbers for screen readers.
 */
export function TrendChart({
  data,
  currentLabel,
  previousLabel,
  formatValue,
  formatTick,
  tableCaption,
  className,
}: TrendChartProps) {
  const gradientId = `trend-${useId().replace(/:/g, "")}`
  const names = { current: currentLabel, previous: previousLabel }
  return (
    <>
      <ChartContainer config={config} className={cn("aspect-auto h-72 w-full", className)}>
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-current)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--color-current)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tickMargin={10}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tickCount={5}
            tickFormatter={formatTick}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={(props) => (
              <TrendTooltip
                active={props.active}
                payload={props.payload}
                label={props.label}
                formatValue={formatValue}
                names={names}
              />
            )}
          />
          <Line
            dataKey="previous"
            type="monotone"
            stroke="var(--color-previous)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
          <Area
            dataKey="current"
            type="monotone"
            stroke="var(--color-current)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">{currentLabel}</th>
            <th scope="col">{previousLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{formatValue(point.current)}</td>
              <td>{formatValue(point.previous)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
