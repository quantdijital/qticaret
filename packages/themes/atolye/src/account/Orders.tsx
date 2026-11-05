import { ChevronRight, Package, ShoppingBag } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { AccountOrderView, ImageView, OrderStepView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * Where an order stands in words: a transfer still waiting says so, else
 * the last step done ("Kargoya verildi"); a cancelled one, its status.
 */
export function statusOf(order: AccountOrderView): string {
  const steps = order.progress
  if (!steps) {
    return order.status
  }
  const current = steps.find((step) => step.state === "current")
  if (current?.key === "paid") {
    return current.label
  }
  return steps.findLast((step) => step.state === "done")?.label ?? order.status
}

/** The order's photos as a small overlapping stack; a parcel icon when none has one. */
export function Thumbs({
  images,
  size = "md",
}: {
  images: readonly ImageView[]
  size?: "md" | "lg"
}) {
  const box = size === "lg" ? "size-20 rounded-media" : "size-14 rounded-inner"
  if (images.length === 0) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center bg-paper-3", box)}>
        <Package className="size-6 text-text-2" aria-hidden="true" strokeWidth={1.75} />
      </span>
    )
  }
  return (
    <span className="flex shrink-0">
      {images.map((image, index) => (
        <span
          key={`${image.src}:${String(index)}`}
          className={cn(
            "relative overflow-hidden bg-paper-3 ring-2 ring-paper-2",
            box,
            index > 0 && "-ml-6"
          )}
        >
          <ResponsiveImage
            image={{ ...image, alt: "" }}
            sizes={size === "lg" ? "80px" : "56px"}
            className="h-full w-full object-cover"
          />
        </span>
      ))}
    </span>
  )
}

/** The order's steps as five short bars (done green, current in the shop's colour): a picture of the words beside it. */
function StepBar({ steps }: { steps: readonly OrderStepView[] }) {
  return (
    <span aria-hidden="true" className="flex flex-1 gap-1">
      {steps.map((step) => (
        <span
          key={step.key}
          className={cn(
            "h-1.5 flex-1 rounded-pill",
            step.state === "done" && "bg-ok",
            step.state === "current" && "bg-signal",
            step.state === "ahead" && "bg-paper-3"
          )}
        />
      ))}
    </span>
  )
}

/**
 * One order as a filled row, the whole row its link: the photos, the
 * number, when and how many, the total heavy; under them where it stands
 * in words beside a bar of its steps. The order's own page has the full timeline,
 * the parcels and the returns.
 */
export function OrderRow({ order, t }: { order: AccountOrderView; t: Translate }) {
  return (
    <li>
      <a
        href={order.path}
        className="group flex flex-col gap-4 rounded-tile bg-paper-2 p-4 no-underline transition-colors duration-(--dur-micro) hover:bg-paper-3 sm:p-5"
      >
        <span className="flex items-center gap-4">
          <Thumbs images={order.images ?? []} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-md font-extrabold underline-offset-4 group-hover:underline">
              {t("order.title", { id: order.displayId })}
            </span>
            <span className="text-sm text-text-2">
              {order.placedAt}, {t("order.quantity", { count: order.itemCount })}
            </span>
          </span>
          <span className="tabular shrink-0 text-md font-extrabold">{order.total}</span>
          <ChevronRight
            className="size-5 shrink-0 text-text-3 max-sm:hidden"
            aria-hidden="true"
            strokeWidth={2}
          />
        </span>
        <span className="flex items-center gap-3">
          <span className="shrink-0 rounded-pill bg-field px-2.5 py-1 text-xs font-semibold">
            {statusOf(order)}
          </span>
          {order.progress && <StepBar steps={order.progress} />}
        </span>
      </a>
    </li>
  )
}

/** No order yet: what will show here, and the way to the shop. */
export function NoOrders({ t }: { t: Translate }) {
  return (
    <div className="flex flex-col items-start justify-between gap-8 rounded-tile bg-paper-2 p-6 sm:p-8">
      <div className="flex flex-col gap-3">
        <span className="mb-1 flex size-14 shrink-0 items-center justify-center rounded-pill bg-paper">
          <ShoppingBag className="size-6" aria-hidden="true" strokeWidth={1.75} />
        </span>
        <p className="text-title font-extrabold">{t("account.no_orders")}</p>
        <p className="max-w-[44ch] text-md text-text-2">{t("account.no_orders_text")}</p>
      </div>
      <a href="/" className="gf-btn">
        {t("account.start_shopping")}
      </a>
    </div>
  )
}
