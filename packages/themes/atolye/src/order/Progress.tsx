import { Check } from "lucide-react"
import type { OrderStepView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** What happens next, by the step the order stands at; none current: it arrived (`order.next_done`). */
export const NEXT: Record<OrderStepView["key"], string> = {
  placed: "order.next_paid",
  paid: "order.next_paid",
  packed: "order.next_packed",
  shipped: "order.next_shipped",
  delivered: "order.next_delivered",
}

/**
 * Where the order stands: its steps down a line, each done one ticked in
 * the "ok" green with when it happened, the current one ringed in the
 * shop's colour, the ones ahead hollow; under them, in one sentence, what
 * happens next. The line between two done steps is drawn full.
 */
export function Progress({ steps, t }: { steps: readonly OrderStepView[]; t: Translate }) {
  const current = steps.find((step) => step.state === "current")
  return (
    <section
      aria-labelledby="siparis-durumu"
      className="flex flex-col gap-6 rounded-tile gf-pane p-5 sm:p-7"
    >
      <h2 id="siparis-durumu" className="text-title">
        {t("order.progress")}
      </h2>
      <ol className="flex flex-col">
        {steps.map((step, index) => {
          const last = index === steps.length - 1
          return (
            <li
              key={step.key}
              aria-current={step.state === "current" ? "step" : undefined}
              className="relative flex min-h-14 gap-4 pb-4 last:pb-0"
            >
              {!last && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-8 bottom-0 left-3.75 w-0.5 rounded-pill",
                    step.state === "done" && steps[index + 1]?.state === "done"
                      ? "bg-ok"
                      : "bg-paper-3"
                  )}
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "relative flex size-8 shrink-0 items-center justify-center rounded-pill",
                  step.state === "done" && "bg-ok text-paper",
                  step.state === "current" && "bg-field ring-2 ring-signal ring-inset",
                  step.state === "ahead" && "bg-paper-3"
                )}
              >
                {step.state === "done" && (
                  <Check className="size-4" aria-hidden="true" strokeWidth={3} />
                )}
                {step.state === "current" && <span className="size-2.5 rounded-pill bg-signal" />}
              </span>
              <span className="flex min-w-0 flex-col pt-1">
                <span
                  className={cn(
                    "text-md leading-tight font-semibold",
                    step.state === "current" && "font-extrabold",
                    step.state === "ahead" && "text-text-2"
                  )}
                >
                  {step.label}
                  {step.state === "done" && (
                    <span className="sr-only"> ({t("order.step_done")})</span>
                  )}
                </span>
                {step.at && <span className="tabular text-sm text-text-2">{step.at}</span>}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="rounded-media gf-pane-inner p-4 text-md">
        {t(current ? NEXT[current.key] : "order.next_done")}
      </p>
    </section>
  )
}
