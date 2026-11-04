import type { FreeShippingView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

// The production CSP refuses inline style attributes: the bar's width is a
// class, in 5% steps, each written out so Tailwind generates it
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

export const fillOf = (percent: number): string =>
  FILLS[Math.min(20, Math.max(0, Math.floor(percent / 5)))] ?? "w-0"

/**
 * How near the cart is to free shipping (design.md § Mini cart): the
 * storefront's sentence, then an 8 px bar in the signal over sand; past
 * the threshold the sentence turns the "ok" green and the bar is full.
 */
export function FreeShippingBar({ view }: { view: FreeShippingView }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={cn("text-sm font-medium", view.reached && "text-ok")}>{view.message}</p>
      <div aria-hidden="true" className="h-2 bg-paper-3">
        <div className={cn("h-full", view.reached ? "bg-ok" : "bg-signal", fillOf(view.percent))} />
      </div>
    </div>
  )
}
