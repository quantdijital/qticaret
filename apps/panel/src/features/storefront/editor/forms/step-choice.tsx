import { useRef } from "react"
import type { ReactNode } from "react"
import { HiddenHint } from "@qticaret/admin-ui/patterns/info-tip"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { HintedName } from "./field-hint"
import { Head, ResetButton } from "./marquee-controls"

const COLUMNS: Readonly<Record<number, string>> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
}

/** A grid asked for by name (`columns`): five steps on one line, ten on two. */
const GRID: Readonly<Record<number, string>> = { 3: "grid-cols-3", 5: "grid-cols-5" }

/**
 * A setting's steps side by side (adr/0049 Ek 2026-11-14 §6): its
 * everyday Turkish name with the technical term small beside it, the
 * chosen step marked, an optional small drawing per step and "Varsayılana
 * dön" once it differs from the default. A setting always has a step, so
 * picking the chosen one again keeps it.
 */
export function StepChoice<T extends string | number>({
  id,
  label,
  term,
  hint,
  steps,
  value,
  fallback,
  nameOf,
  drawOf,
  onChange,
  columns,
}: {
  id: string
  label: string
  term: string
  hint?: string | undefined
  steps: readonly T[]
  value: T
  fallback: T
  nameOf: (step: T) => string
  drawOf?: ((step: T) => ReactNode) | undefined
  onChange: (step: T) => void
  /** Steps a line where there are more than four (a footer row's five grounds, ten splits). */
  columns?: 3 | 5 | undefined
}) {
  const group = useRef<HTMLDivElement>(null)
  return (
    <div id={id} className="flex flex-col gap-2">
      <Head>
        <HintedName name={label} hint={hint} hintId={`${id}-hint`}>
          <span id={`${id}-label`} className="text-sm font-medium">
            {label} <small className="text-[11px] font-normal text-muted-foreground">{term}</small>
          </span>
        </HintedName>
        {value !== fallback ? (
          <ResetButton
            onReset={() => {
              onChange(fallback)
              group.current?.querySelector<HTMLElement>("[role=radio]")?.focus()
            }}
          />
        ) : null}
      </Head>
      <ToggleGroup
        ref={group}
        type="single"
        variant="outline"
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        value={String(value)}
        onValueChange={(next) => {
          const step = steps.find((each) => String(each) === next)
          if (step !== undefined) onChange(step)
        }}
        className={cn("grid w-full", columns ? GRID[columns] : COLUMNS[steps.length])}
      >
        {steps.map((step) => (
          <ToggleGroupItem
            key={String(step)}
            value={String(step)}
            className="h-auto min-w-0 flex-col gap-1 px-1.5 py-2 text-xs data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
          >
            {drawOf ? drawOf(step) : null}
            <span className="truncate">{nameOf(step)}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {hint ? <HiddenHint id={`${id}-hint`}>{hint}</HiddenHint> : null}
    </div>
  )
}
