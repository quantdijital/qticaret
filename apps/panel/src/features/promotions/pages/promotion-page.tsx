import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Loader2, Pause, Play, Trash2 } from "lucide-react"
import { useState } from "react"
import { Controller, FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { beginSave } from "@qticaret/admin-ui/lib/forms"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import {
  campaignMembersQuery,
  promotionQuery,
  useDeletePromotion,
  useUpdatePromotion,
} from "@/features/promotions/api/promotions"
import { useSavePromotion } from "@/features/promotions/api/save-promotion"
import type { Promotion } from "@/features/promotions/api/promotions"
import { CodeBatchesCard } from "@/features/promotions/components/code-batches-card"
import { ConditionsCard } from "@/features/promotions/components/conditions-card"
import { ScheduleBadge } from "@/features/promotions/components/offer-text"
import { PromotionPreview } from "@/features/promotions/components/promotion-preview"
import { OfferCard, UsageCard } from "@/features/promotions/components/promotion-fields"
import { createBody, perCustomerLimit, promotionSchema, valuesOf } from "@/features/promotions/form"
import type { PromotionValues } from "@/features/promotions/form"
import { ownsCampaign } from "@/features/promotions/offer"
import { isPerCustomerBudget } from "@/features/promotions/scope"
import type { BudgetLike } from "@/features/promotions/scope"
import { errorText } from "@/lib/errors"

const CURRENCY = "try"
const detailRoute = getRouteApi("/_auth/promotions/$id")

function PromotionForm({ existing }: { existing: Promotion | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const save = useSavePromotion()
  const members = useQuery({
    ...campaignMembersQuery(existing?.campaign?.id ?? ""),
    enabled: Boolean(existing?.campaign?.id),
  })
  // Dates on a campaign shared with other promotions are not this form's to change
  const datesLocked =
    Boolean(existing?.campaign?.id) && !ownsCampaign(existing?.id ?? "", members.data)
  // Nor a budget of another kind (a total spend set elsewhere)
  const budget = (existing?.campaign as { budget?: BudgetLike | null } | null | undefined)?.budget
  const perCustomerLocked = datesLocked || Boolean(budget && !isPerCustomerBudget(budget))
  const initial = valuesOf(existing)
  const form = useForm<PromotionValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: initial,
  })

  const submit = form.handleSubmit((values) => {
    const settle = beginSave(form)
    save.mutate(
      {
        existing,
        body: createBody(values, CURRENCY),
        datesChanged: values.starts !== initial.starts || values.ends !== initial.ends,
        perCustomer: perCustomerLimit(values),
        perCustomerChanged: values.perCustomer !== initial.perCustomer,
      },
      {
        onSuccess: (id) => {
          settle(values)
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
      >
        <PageGrid>
          <PageColumn span={8}>
            <OfferCard kindLocked={existing !== null} />
            <ConditionsCard perCustomerLocked={perCustomerLocked} />
            <UsageCard datesLocked={datesLocked} />
          </PageColumn>
          <PageColumn span={4} sticky>
            <PromotionPreview existing={existing} />
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
          </PageColumn>
        </PageGrid>
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
  // A failed read again (after a save, say) keeps the page and its form
  if (query.isError && !query.data) {
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
      {promotion.is_automatic || promotion.type !== "standard" ? null : (
        <CodeBatchesCard promotionId={promotion.id} code={promotion.code ?? ""} />
      )}
    </div>
  )
}
