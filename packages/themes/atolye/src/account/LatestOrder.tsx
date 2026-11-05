import { Check } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { AccountOrderView, OrderStepView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { NEXT } from "../order/Progress"
import { statusOf } from "./Orders"

/**
 * The order's steps across the stage: a circle each (done: the "ok"
 * green with a tick; current: ringed in the shop's colour lifted for
 * graphite; ahead: hollow), joined by a line drawn full between two done
 * ones, the step's name under it. On a phone the steps stand down a line.
 */
function StageSteps({ steps, t }: { steps: readonly OrderStepView[]; t: Translate }) {
  return (
    <ol className="flex flex-col sm:flex-row">
      {steps.map((step, index) => {
        const last = index === steps.length - 1
        const joined = step.state === "done" && steps[index + 1]?.state === "done"
        return (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className="relative flex min-h-12 flex-1 gap-3 pb-3 last:pb-0 sm:flex-col sm:gap-2 sm:pr-2 sm:pb-0"
          >
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute rounded-pill max-sm:top-8 max-sm:bottom-0 max-sm:left-3.75 max-sm:w-0.5 sm:top-3.75 sm:right-0 sm:left-8 sm:h-0.5",
                  joined ? "bg-ok" : "bg-stage-rule"
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-pill",
                step.state === "done" && "bg-ok text-stage",
                step.state === "current" && "bg-stage-2 ring-2 ring-signal-on-stage ring-inset",
                step.state === "ahead" && "bg-stage-2"
              )}
            >
              {step.state === "done" && <Check className="size-4" strokeWidth={3} />}
              {step.state === "current" && (
                <span className="size-2.5 rounded-pill bg-signal-on-stage" />
              )}
            </span>
            <span
              className={cn(
                "pt-1 text-sm leading-tight font-semibold sm:pt-0",
                step.state === "current" && "font-extrabold",
                step.state === "ahead" && "text-stage-text-2"
              )}
            >
              {step.label}
              {step.state === "done" && <span className="sr-only"> ({t("order.step_done")})</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The overview's latest order on a graphite stage: its number, date,
 * size and total as plain facts, its first photo sinking into the stage
 * from the right, where it stands step by step and in one sentence what
 * happens next, the way to its page (the parcels, the tracking, the returns).
 */
export function LatestOrder({ order, t }: { order: AccountOrderView; t: Translate }) {
  const steps = order.progress ?? null
  const current = steps?.find((step) => step.state === "current")
  const photo = order.images?.[0] ?? null
  const facts: [string, string][] = [
    [t("order.number"), `#${order.displayId}`],
    [t("order.placed_at"), order.placedAt],
    [t("order.lines"), t("order.quantity", { count: order.itemCount })],
    [t("cart.total"), order.total],
  ]
  return (
    <section
      aria-labelledby="son-siparis"
      className="gf-stage relative isolate flex flex-col gap-7 overflow-hidden rounded-tile p-5 sm:p-7 lg:p-8"
    >
      {photo && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 -z-10 w-1/2 before:absolute before:inset-0 before:z-1 before:bg-linear-to-t before:from-stage before:from-35% before:to-transparent after:absolute after:inset-0 after:bg-linear-to-r after:from-stage after:via-stage/50 after:to-transparent sm:w-2/5"
        >
          <ResponsiveImage
            image={{ ...photo, alt: "" }}
            sizes="(min-width: 1024px) 24vw, 40vw"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-col gap-5">
        <h2 id="son-siparis" className="text-section">
          {t("account.latest_order")}
        </h2>
        <dl className="grid max-w-[34rem] grid-cols-2 gap-x-6 gap-y-4">
          {facts.map(([term, value]) => (
            <div key={term} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-sm text-stage-text-2">{term}</dt>
              <dd className="tabular text-md font-extrabold break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {steps ? (
        <StageSteps steps={steps} t={t} />
      ) : (
        <p className="text-md font-semibold">{statusOf(order)}</p>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {steps && (
          <p className="max-w-[48ch] text-md text-stage-text-2">
            {t(current ? NEXT[current.key] : "order.next_done")}
          </p>
        )}
        <a href={order.path} className="gf-btn shrink-0 self-start sm:self-auto">
          {t("account.view_order")}
        </a>
      </div>
    </section>
  )
}
