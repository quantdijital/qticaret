import { Ban, CreditCard, PackageCheck, ShoppingBag, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { OrderDetail } from "@/features/orders/api/orders"
import { lifecycleOf, milestones } from "@/features/orders/order-math"
import type { OrderFacts } from "@/features/orders/order-math"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const STEPS: { key: "placed" | "paid" | "shipped" | "delivered"; icon: LucideIcon }[] = [
  { key: "placed", icon: ShoppingBag },
  { key: "paid", icon: CreditCard },
  { key: "shipped", icon: Truck },
  { key: "delivered", icon: PackageCheck },
]

/** The order's way from checkout to the door, each step with when it happened. */
export function ProgressCard({ order }: { order: OrderDetail }) {
  const { t } = useTranslation()
  const facts = order as unknown as OrderFacts & { created_at: string }
  const when = milestones(facts)
  const canceled = lifecycleOf(facts) === "canceled"
  const reached = STEPS.filter((step) => when[step.key]).length

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
    </section>
  )
}
