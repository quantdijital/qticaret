import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

export interface StepPoint {
  /** When the value took effect, in milliseconds. */
  at: number
  value: number
  reference: number
}

interface StepChartProps {
  data: StepPoint[]
  /** The time the axis spans, in milliseconds. */
  domain: [number, number]
  names: { value: string; reference: string }
  formatValue: (value: number) => string
  formatTick: (value: number) => string
  formatTime: (at: number) => string
  tableCaption: string
  className?: string
}

// The value in the brand colour, the reference in the de-emphasis grey. Keys
// are not "primary"/"secondary": those name the theme's own colours
const COLORS = { value: "var(--chart-1)", reference: "var(--chart-muted)" } as const
const config = {
  value: { label: "value", color: COLORS.value },
  reference: { label: "reference", color: COLORS.reference },
} satisfies ChartConfig

const KEYS = ["value", "reference"] as const

function LineKey({ series }: { series: (typeof KEYS)[number] }) {
  return (
    <span
      aria-hidden="true"
      className="h-0.5 w-3 rounded-full"
      style={{ background: COLORS[series] }}
    />
  )
}

interface TooltipRow {
  dataKey?: unknown
  value?: unknown
}

function StepTooltip({
  active,
  payload,
  label,
  props,
}: {
  active?: boolean | undefined
  payload?: readonly TooltipRow[] | undefined
  label?: string | number | undefined
  props: Pick<StepChartProps, "names" | "formatValue" | "formatTime">
}) {
  if (!active || !payload?.length) {
    return null
  }
  return (
    <div className="min-w-44 rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-overlay">
      <p className="mb-1.5 text-xs text-muted-foreground">{props.formatTime(Number(label))}</p>
      <ul className="flex flex-col gap-1">
        {KEYS.flatMap((key) => {
          const row = payload.find((entry) => entry.dataKey === key)
          return row
            ? [
                <li key={key} className="flex items-center gap-2 text-xs">
                  <LineKey series={key} />
                  <span className="text-muted-foreground">{props.names[key]}</span>
                  <span className="tabular ml-auto pl-4 text-sm font-semibold text-foreground">
                    {props.formatValue(Number(row.value))}
                  </span>
                </li>,
              ]
            : []
        })}
      </ul>
    </div>
  )
}

/**
 * A value that changes in steps over time against a quiet reference
 * (dataviz: emphasis): the value in the brand colour, the reference in the
 * de-emphasis grey, both 2px, held flat until the next change. One axis,
 * hairline grid, a crosshair tooltip with both, a legend of line keys, and
 * a table with the same numbers for screen readers.
 */
export function StepChart(props: StepChartProps) {
  const { data, domain, names, formatValue, formatTick, formatTime, tableCaption, className } =
    props
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {KEYS.map((key) => (
          <li key={key} className="flex items-center gap-1.5">
            <LineKey series={key} />
            {names[key]}
          </li>
        ))}
      </ul>
      <ChartContainer config={config} className={cn("aspect-auto h-56 w-full", className)}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="at"
            type="number"
            scale="time"
            domain={domain}
            tickFormatter={(value: number) => formatTime(value)}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tickMargin={10}
            minTickGap={32}
          />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tickCount={4}
            // Clean round ticks around the prices; a price line needs no zero baseline
            domain={["auto", "auto"]}
            allowDecimals={false}
            tickFormatter={formatTick}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={(tooltip) => (
              <StepTooltip
                active={tooltip.active}
                payload={tooltip.payload}
                label={tooltip.label}
                props={{ names, formatValue, formatTime }}
              />
            )}
          />
          {(["reference", "value"] as const).map((key) => (
            <Line
              key={key}
              dataKey={key}
              type="stepAfter"
              stroke={COLORS[key]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">{names.value}</th>
            <th scope="col">{names.reference}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.at}>
              <th scope="row">{formatTime(point.at)}</th>
              <td>{formatValue(point.value)}</td>
              <td>{formatValue(point.reference)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
