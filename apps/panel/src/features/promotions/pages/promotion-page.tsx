import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Loader2, Pause, Play, Trash2 } from "lucide-react"
import { useState } from "react"
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { LeaveGuard } from "@/components/patterns/leave-guard"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  promotionQuery,
  useDeletePromotion,
  useSavePromotion,
  useUpdatePromotion,
} from "@/features/promotions/api/promotions"
import type { Promotion } from "@/features/promotions/api/promotions"
import { OfferText, ScheduleBadge } from "@/features/promotions/components/offer-text"
import { OfferCard, UsageCard } from "@/features/promotions/components/promotion-fields"
import { createBody, promotionSchema, valuesOf } from "@/features/promotions/form"
import type { PromotionValues } from "@/features/promotions/form"
import { applicationMethod } from "@/features/promotions/offer"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"
import { parseMoneyInput } from "@/lib/money-input"

const CURRENCY = "try"
const detailRoute = getRouteApi("/_auth/promotions/$id")

function Preview({ existing }: { existing: Promotion | null }) {
  const { t } = useTranslation()
  const [kind, value, code, automatic] = useWatch<
    PromotionValues,
    ["kind", "value", "code", "automatic"]
  >({
    name: ["kind", "value", "code", "automatic"],
  })
  const method = applicationMethod(kind, parseMoneyInput(value) ?? 0, CURRENCY)
  return (
    <SectionCard title={t("promotions.form.preview")}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-5">
          <span className="text-2xl font-semibold tracking-tight">
            <OfferText method={method} />
          </span>
          <span className="rounded-md border bg-background px-2.5 py-1 font-mono text-sm tracking-wider uppercase">
            {code.trim() || "KOD"}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {t(automatic ? "promotions.form.previewAutomatic" : "promotions.form.previewCode")}
          </span>
        </div>
        {existing ? (
          <dl className="flex flex-col divide-y text-sm">
            <div className="flex justify-between py-2">
              <dt className="text-muted-foreground">{t("promotions.columns.status")}</dt>
              <dd>
                <ScheduleBadge promotion={existing} />
              </dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-muted-foreground">{t("promotions.columns.used")}</dt>
              <dd className="tabular-nums">
                {formatCount(existing.used ?? 0)}
                {existing.limit ? ` / ${formatCount(existing.limit)}` : ""}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
    </SectionCard>
  )
}

function PromotionForm({ existing }: { existing: Promotion | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const save = useSavePromotion()
  const form = useForm<PromotionValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: valuesOf(existing),
  })

  const submit = form.handleSubmit((values) => {
    save.mutate(
      { existing, body: createBody(values, CURRENCY) },
      {
        onSuccess: (id) => {
          form.reset(values)
          toast.success(t(existing ? "promotions.saved" : "promotions.created"))
          if (!existing) {
            void navigate({ to: "/promotions/$id", params: { id }, ignoreBlocker: true })
          }
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })

  return (
    <FormProvider {...form}>
      <LeaveGuard when={form.formState.isDirty && !save.isPending} />
      <form
        noValidate
        onSubmit={(event) => {
          void submit(event)
        }}
        className="grid items-start gap-[var(--grid-gap)] xl:grid-cols-12"
      >
        <div className="flex min-w-0 flex-col gap-[var(--grid-gap)] xl:col-span-8">
          <OfferCard kindLocked={existing !== null} />
          <UsageCard />
        </div>
        <div className="flex min-w-0 flex-col gap-[var(--grid-gap)] xl:sticky xl:top-20 xl:col-span-4">
          <Preview existing={existing} />
          {existing ? null : (
            <label
              htmlFor="promotion-activate"
              className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border bg-card px-4 py-3 shadow-card"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t("promotions.form.activate")}</span>
                <span className="text-[13px] text-muted-foreground">
                  {t("promotions.form.activateHint")}
                </span>
              </span>
              <Controller
                control={form.control}
                name="activate"
                render={({ field }) => (
                  <Switch
                    id="promotion-activate"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </label>
          )}
          <Button
            type="submit"
            disabled={save.isPending || (existing !== null && !form.formState.isDirty)}
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {t(existing ? "common.save" : "promotions.create")}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}

function Actions({ promotion }: { promotion: Promotion }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const update = useUpdatePromotion(promotion.id)
  const remove = useDeletePromotion()
  const [confirm, setConfirm] = useState(false)
  const active = promotion.status === "active"
  return (
    <>
      <Button
        variant={active ? "outline" : "default"}
        disabled={update.isPending}
        onClick={() => {
          update.mutate(
            { status: active ? "inactive" : "active" },
            {
              onSuccess: () =>
                toast.success(t(active ? "promotions.paused" : "promotions.started")),
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        }}
      >
        {active ? <Pause /> : <Play />}
        {t(active ? "promotions.pause" : "promotions.start")}
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={t("promotions.delete")}
        onClick={() => {
          setConfirm(true)
        }}
      >
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("promotions.deleteTitle", { code: promotion.code })}
        description={t("promotions.deleteDescription")}
        confirmLabel={t("promotions.delete")}
        destructive
        onConfirm={() => {
          remove.mutate(promotion, {
            onSuccess: () => {
              toast.success(t("promotions.deleted"))
              void navigate({ to: "/promotions" })
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </>
  )
}

/** A new promotion (docs/06 §4): what it gives, how it is used, a live preview. */
export function NewPromotionPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("promotions.new")}
        back={{ to: "/promotions", label: t("nav.promotions") }}
      />
      <PromotionForm existing={null} />
    </div>
  )
}

/** One promotion: the same form, with start/pause and delete. */
export function PromotionPage() {
  const { t } = useTranslation()
  const { id } = detailRoute.useParams()
  const query = useQuery(promotionQuery(id))
  const back = { to: "/promotions", label: t("nav.promotions") }
  if (query.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("promotions.title")} back={back} />
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      </div>
    )
  }
  if (!query.data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("common.loading")} back={back} />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    )
  }
  const promotion = query.data
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={promotion.code ?? ""}
        badge={<ScheduleBadge promotion={promotion} />}
        back={back}
        action={<Actions promotion={promotion} />}
      />
      <PromotionForm key={promotion.id} existing={promotion} />
    </div>
  )
}
