import { CalendarClock } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useSetPublishSchedule } from "@/features/products/api/publish-schedule"
import type { ProductDetail } from "@/features/products/api/products"
import {
  publishFieldValue,
  publishScheduleOf,
  readPublishAt,
} from "@/features/products/publish-schedule"
import type { ScheduleProblem } from "@/features/products/publish-schedule"
import { errorText } from "@/lib/errors"

const S = "products.schedule"

/**
 * "Yayın tarihi" in the product's summary (S2, docs/06 "Ürün sayfası";
 * WooCommerce's "Publish immediately → Edit"): a draft goes live by hand
 * or at a moment typed as Türkiye's clock; planned, the moment shows with
 * "Değiştir" and "İptal". A planned publish the server held back (the SEO
 * gate) says so here. Edited in place; a live product shows nothing.
 */
export function PublishScheduleRow({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const schedule = publishScheduleOf(product)
  const save = useSetPublishSchedule(product.id)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")
  const [problem, setProblem] = useState<ScheduleProblem | null>(null)

  if (product.status !== "draft") {
    return null
  }
  const open = () => {
    setValue(publishFieldValue(schedule.publish_at))
    setProblem(null)
    setEditing(true)
  }
  const send = (publishAt: string | null, done: string) => {
    save.mutate(publishAt, {
      onSuccess: () => {
        setEditing(false)
        toast.success(t(done))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  const submit = () => {
    const read = readPublishAt(value)
    setProblem(read.problem)
    if (read.at) {
      send(read.at, `${S}.saved`)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-3" data-testid="publish-schedule">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-muted-foreground">{t(`${S}.label`)}</span>
        {editing ? null : (
          <span className="text-right">
            {schedule.publish_at ? formatDateTime(schedule.publish_at) : t(`${S}.manual`)}
          </span>
        )}
      </div>
      {editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <Input
            type="datetime-local"
            aria-label={t(`${S}.field`)}
            aria-invalid={problem ? true : undefined}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setProblem(null)
            }}
          />
          <p
            className={problem ? "text-xs text-destructive-text" : "text-xs text-muted-foreground"}
          >
            {problem ? t(`${S}.problem.${problem}`) : t(`${S}.zone`)}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false)
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={save.isPending}>
              {t(`${S}.plan`)}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          {schedule.publish_at ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={save.isPending}
              onClick={() => {
                send(null, `${S}.cancelled`)
              }}
            >
              {t(`${S}.cancel`)}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={open}>
            <CalendarClock />
            {t(schedule.publish_at ? `${S}.change` : `${S}.schedule`)}
          </Button>
        </div>
      )}
      {schedule.failed && !schedule.publish_at ? (
        <p className="text-xs text-warning-text">
          {t(`${S}.failed`, {
            at: formatDateTime(schedule.failed.at),
            reason: t(
              `${S}.reason.${schedule.failed.reason === "seo.publish_gate_blocked" ? "seo" : "other"}`
            ),
          })}
        </p>
      ) : null}
    </div>
  )
}
