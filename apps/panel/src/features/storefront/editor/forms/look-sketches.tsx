import { AlignCenter, AlignLeft } from "lucide-react"
import type { SectionLookField, SectionLookStep } from "@qticaret/types"
import { cn } from "@qticaret/admin-ui/lib/utils"

// Each look step drawn in small (adr/0049 Ek 2026-11-14 §6: options told
// with pictures, not words alone): a plain sketch in the current colour,
// the grounds as swatches of the panel's own tones, not the shop's colours

const SPACE: Readonly<Record<SectionLookStep<"space_outer">, number>> = {
  none: 0,
  small: 2,
  medium: 4,
  large: 6,
}

/** The gap above a block: the block sits lower as the step grows. */
function Outer({ step }: { step: SectionLookStep<"space_outer"> }) {
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
      <rect x={2} y={0} width={20} height={1.5} rx={0.75} className="fill-current opacity-35" />
      <rect
        x={2}
        y={2 + SPACE[step]}
        width={20}
        height={14 - 2 - SPACE[step]}
        rx={1.5}
        className="fill-current opacity-60"
      />
    </svg>
  )
}

/** The room inside a frame: its content shrinks as the step grows. */
function Inner({ step }: { step: SectionLookStep<"space_inner"> }) {
  const room = SPACE[step] / 2
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
      <rect x={1} y={1} width={22} height={14} rx={2} className="fill-none stroke-current" />
      <rect
        x={3 + room}
        y={3 + room}
        width={18 - 2 * room}
        height={10 - 2 * room}
        rx={1}
        className="fill-current opacity-60"
      />
    </svg>
  )
}

const GROUND: Readonly<Record<SectionLookStep<"ground">, string>> = {
  page: "bg-background",
  well: "bg-muted",
  stage: "bg-foreground",
  primary: "bg-primary",
}

const WIDTH: Readonly<Record<SectionLookStep<"width">, string>> = {
  narrow: "w-2.5",
  boxed: "w-4",
  full: "w-6",
}

/** A step of a look field in small, beside its everyday name. */
export function LookSketch<F extends SectionLookField>({
  field,
  step,
}: {
  field: F
  step: SectionLookStep<F>
}) {
  switch (field) {
    case "space_outer":
      return <Outer step={step as SectionLookStep<"space_outer">} />
    case "space_inner":
      return <Inner step={step as SectionLookStep<"space_inner">} />
    case "ground":
      return (
        <span
          aria-hidden="true"
          className={cn(
            "size-4 rounded-full border border-border",
            GROUND[step as SectionLookStep<"ground">]
          )}
        />
      )
    case "align":
      return step === "center" ? (
        <AlignCenter aria-hidden="true" className="size-4" />
      ) : (
        <AlignLeft aria-hidden="true" className="size-4" />
      )
    case "width":
      return (
        <span aria-hidden="true" className="flex h-4 w-6 items-center justify-center">
          <span
            className={cn(
              "h-2.5 rounded-sm bg-current opacity-60",
              WIDTH[step as SectionLookStep<"width">]
            )}
          />
        </span>
      )
  }
  return null
}
