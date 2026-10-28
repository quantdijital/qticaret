import { Ban, CreditCard, PackageCheck, ShoppingBag, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { OrderDetail } from "@/features/orders/api/orders"
import type { Lifecycle } from "@/features/dashboard/api/overview"
import { milestones } from "@/features/orders/order-math"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const STEPS: { key: "placed" | "paid" | "shipped" | "delivered"; icon: LucideIcon }[] = [
  { key: "placed", icon: ShoppingBag },
  { key: "paid", icon: CreditCard },
  { key: "shipped", icon: Truck },
  { key: "delivered", icon: PackageCheck },
]

// Asked for in the order's fields; the SDK's fulfillment type does not name them
interface Labelled {
  labels?: { tracking_number: string; tracking_url: string }[] | null
}

/** The carriers' tracking numbers of the order's live parcels, each with its page when given. */
function trackingOf(order: OrderDetail): { number: string; url: string | null }[] {
  return (order.fulfillments ?? [])
    .filter((fulfillment) => !fulfillment.canceled_at)
    .flatMap((fulfillment) => (fulfillment as Labelled).labels ?? [])
    .filter((label) => label.tracking_number)
    .map((label) => ({
      number: label.tracking_number,
      // Only a web page: a label's address is the carrier's, never a script
      url: /^https?:\/\//.test(label.tracking_url) ? label.tracking_url : null,
    }))
}

/** The order's way from checkout to the door, each step with when it happened. */
export function ProgressCard({ order, stage }: { order: OrderDetail; stage: Lifecycle }) {
  const { t } = useTranslation()
  const when = milestones(order, stage)
  const canceled = stage === "canceled"
  const reached = STEPS.filter((step) => when[step.key]).length
  const tracking = trackingOf(order)

  return (
    <section className="rounded-lg border bg-card px-5 py-5 shadow-card">
      {canceled ? (
        <p className="mb-4 flex items-center gap-2 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-text">
          <Ban className="size-4" aria-hidden="true" />
          {t("orders.detail.canceledNote")}
        </p>
      ) : null}
      <ol className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
        {STEPS.map((step, index) => {
          const done = Boolean(when[step.key])
          const current = !canceled && index === reached
          return (
            <li key={step.key} className="relative flex flex-col items-start gap-2 pr-4">
              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-[18px] right-0 left-11 hidden h-0.5 rounded-full sm:block",
                    index < reached - 1 ? "bg-primary" : "bg-border"
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary text-foreground ring-4 ring-primary/15",
                  !done && !current && "text-muted-foreground"
                )}
              >
                <step.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="flex flex-col">
                <span
                  className={cn(
                    "text-sm",
                    done || current ? "font-medium" : "text-muted-foreground"
                  )}
                >
                  {t(`orders.progress.${step.key}`)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {when[step.key]
                    ? formatDateTime(when[step.key] ?? "")
                    : current
                      ? t("orders.progress.next")
                      : "—"}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      {tracking.length > 0 ? (
        <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-sm">
          <span className="text-muted-foreground">{t("orders.progress.tracking")}</span>
          {tracking.map((each) =>
            each.url ? (
              <a
                key={each.number}
                href={each.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium tabular-nums underline-offset-4 hover:underline"
              >
                {each.number}
              </a>
            ) : (
              <span key={each.number} className="font-medium tabular-nums">
                {each.number}
              </span>
            )
          )}
        </p>
      ) : null}
    </section>
  )
}
