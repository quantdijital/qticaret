import type { FreeShippingView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

// The CSP refuses inline styles: the fill is a class in 5% steps, each written out for Tailwind
const FILLS = [
  "w-0",
  "w-[5%]",
  "w-[10%]",
  "w-[15%]",
  "w-[20%]",
  "w-[25%]",
  "w-[30%]",
  "w-[35%]",
  "w-[40%]",
  "w-[45%]",
  "w-[50%]",
  "w-[55%]",
  "w-[60%]",
  "w-[65%]",
  "w-[70%]",
  "w-[75%]",
  "w-[80%]",
  "w-[85%]",
  "w-[90%]",
  "w-[95%]",
  "w-full",
] as const

/** A percentage's fill class, 0 to 100 in 5% steps. */
export const fillOf = (percent: number): string =>
  FILLS[Math.min(20, Math.max(0, Math.floor(percent / 5)))] ?? "w-0"

/**
 * How near the cart is to free shipping: the storefront's sentence over a
 * rounded 8 px track; past the threshold the sentence turns the "ok"
 * green and the track is full.
 */
export function FreeShippingMeter({ view }: { view: FreeShippingView }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={cn("text-sm font-semibold", view.reached && "text-ok")}>{view.message}</p>
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-paper-3">
        <div
          className={cn(
            "h-full rounded-pill",
            view.reached ? "bg-ok" : "bg-signal",
            fillOf(view.percent)
          )}
        />
      </div>
    </div>
  )
}
