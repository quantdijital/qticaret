import { ArrowLeft, ArrowRight, MousePointer2, Pause } from "lucide-react"
import type { MarqueeSetting, MarqueeStep } from "@qticaret/types"
import { cn } from "@qticaret/admin-ui/lib/utils"

// Each of a scrolling strip's steps drawn in small (the plan's rule: options
// told with pictures, not words alone), in the current colour; the grounds
// as swatches of the panel's own tones, as the look's are

/** A strip's size: a thin line, a row with an icon and two lines, one big word. */
function Size({ step }: { step: MarqueeStep<"size"> }) {
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
      {step === "small" ? (
        <rect x={1} y={7} width={22} height={2} rx={1} className="fill-current opacity-60" />
      ) : step === "medium" ? (
        <>
          <circle cx={4} cy={8} r={2.5} className="fill-none stroke-current" />
          <rect x={8} y={5} width={14} height={2.5} rx={1} className="fill-current opacity-70" />
          <rect
            x={8}
            y={9.5}
            width={10}
            height={1.5}
            rx={0.75}
            className="fill-current opacity-40"
          />
        </>
      ) : (
        <rect x={1} y={3} width={22} height={10} rx={1.5} className="fill-current opacity-70" />
      )}
    </svg>
  )
}

const GROUND: Readonly<Record<MarqueeStep<"ground">, string>> = {
  stage: "bg-foreground",
  primary: "bg-primary",
  light: "bg-muted",
}

const SEPARATOR: Readonly<Record<MarqueeStep<"separator">, string>> = {
  none: "",
  dot: "•",
  star: "✦",
  line: "|",
}

/** The room between items: two words with a narrow, normal or wide gap. */
function Gap({ step }: { step: MarqueeStep<"gap"> }) {
  const room = { tight: 2, normal: 4, wide: 8 }[step]
  const word = (22 - room) / 2
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden="true">
      <rect x={1} y={6.5} width={word} height={3} rx={1} className="fill-current opacity-70" />
      <rect
        x={1 + word + room}
        y={6.5}
        width={word}
        height={3}
        rx={1}
        className="fill-current opacity-70"
      />
    </svg>
  )
}

/** One step of a scrolling strip's setting, drawn in small. */
export function MarqueeSketch<S extends MarqueeSetting>({
  setting,
  step,
}: {
  setting: S
  step: MarqueeStep<S>
}) {
  switch (setting) {
    case "size":
      return <Size step={step as MarqueeStep<"size">} />
    case "ground":
      return (
        <span
          aria-hidden="true"
          className={cn("h-4 w-6 rounded-sm border", GROUND[step as MarqueeStep<"ground">])}
        />
      )
    case "direction": {
      const Arrow = step === "right" ? ArrowRight : ArrowLeft
      return <Arrow aria-hidden="true" className="size-4" />
    }
    case "pause_button": {
      const Icon = step === "hover" ? MousePointer2 : Pause
      return <Icon aria-hidden="true" className="size-4" />
    }
    case "weight":
      return (
        <span
          aria-hidden="true"
          className={cn(
            "text-[13px] leading-4",
            step === "bold" ? "font-extrabold" : "font-normal"
          )}
        >
          Aa
        </span>
      )
    case "gap":
      return <Gap step={step as MarqueeStep<"gap">} />
    case "separator":
      return (
        <span aria-hidden="true" className="flex h-4 w-6 items-center justify-center gap-0.5">
          <span className="h-1 w-1.5 rounded-full bg-current opacity-40" />
          <span className="w-2 text-center text-[11px] leading-none">
            {SEPARATOR[step as MarqueeStep<"separator">]}
          </span>
          <span className="h-1 w-1.5 rounded-full bg-current opacity-40" />
        </span>
      )
    // The speed is a row of stops, the on/off ones switches: nothing to draw
    case "speed":
    case "hover_pause":
    case "uppercase":
    case "outline":
    case "closable":
      return null
  }
}
