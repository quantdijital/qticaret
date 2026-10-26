import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { Loader2, Pause, Play, Trash2 } from "lucide-react"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { LeaveGuard } from "@/components/patterns/leave-guard"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  priceListQuery,
  useDeletePriceList,
  useSavePriceList,
  useSetPriceListStatus,
} from "@/features/price-lists/api/price-lists"
import type { PriceList } from "@/features/price-lists/api/price-lists"
import { ListBadge } from "@/features/price-lists/components/list-badge"
import { AudienceCard, DetailsCard } from "@/features/price-lists/components/list-fields"
import { PriceLinesCard } from "@/features/price-lists/components/price-lines-card"
import { bodyOf, priceListSchema, valuesOf } from "@/features/price-lists/form"
import type { PriceListValues } from "@/features/price-lists/form"
import { errorText } from "@/lib/errors"

const detailRoute = getRouteApi("/_auth/promotions/price-lists/$id")
const BACK_TO = "/promotions/price-lists"

function PriceListForm({ existing }: { existing: PriceList | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const save = useSavePriceList(existing?.id ?? null)
  const initial = valuesOf(existing)
  const form = useForm<PriceListValues>({
    resolver: zodResolver(priceListSchema),
    defaultValues: initial,
  })
  const submit = form.handleSubmit((values) => {
    const datesChanged = values.starts !== initial.starts || values.ends !== initial.ends
    save.mutate(bodyOf(values, existing, datesChanged), {
      onSuccess: (id) => {
        form.reset(values)
        toast.success(t(existing ? "priceLists.saved" : "priceLists.created"))
        if (!existing) {
          void navigate({ to: "/promotions/price-lists/$id", params: { id }, ignoreBlocker: true })
        }
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
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
          <DetailsCard />
          <AudienceCard isNew={existing === null} />
        </div>
        <div className="flex min-w-0 flex-col gap-[var(--grid-gap)] xl:sticky xl:top-20 xl:col-span-4">
          {existing ? null : (
            <p className="rounded-lg border bg-card px-4 py-3 text-[13px] text-muted-foreground shadow-card">
              {t("priceLists.form.productsAfter")}
            </p>
          )}
          <Button
            type="submit"
            disabled={save.isPending || (existing !== null && !form.formState.isDirty)}
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {t(existing ? "common.save" : "priceLists.create")}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}

function Actions({ list }: { list: PriceList }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const status = useSetPriceListStatus(list.id)
  const remove = useDeletePriceList()
  const [confirm, setConfirm] = useState(false)
  const active = list.status === "active"
  return (
    <>
      <Button
        variant={active ? "outline" : "default"}
        disabled={status.isPending}
        onClick={() => {
          status.mutate(active ? "draft" : "active", {
            onSuccess: () => toast.success(t(active ? "priceLists.paused" : "priceLists.started")),
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      >
        {active ? <Pause /> : <Play />}
        {t(active ? "priceLists.pause" : "priceLists.start")}
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={t("priceLists.delete")}
        onClick={() => {
          setConfirm(true)
        }}
      >
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("priceLists.deleteTitle", { title: list.title })}
        description={t("priceLists.deleteDescription")}
        confirmLabel={t("priceLists.delete")}
        destructive
        onConfirm={() => {
          remove.mutate(list.id, {
            onSuccess: () => {
              toast.success(t("priceLists.deleted"))
              // The list is gone: nothing left to keep in its form
              void navigate({ to: BACK_TO, ignoreBlocker: true })
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      />
    </>
  )
}

/** A new price list (F4.1): its name and kind, then when and for whom; products once saved. */
export function NewPriceListPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("priceLists.new")}
        back={{ to: BACK_TO, label: t("priceLists.sectionPriceLists") }}
      />
      <PriceListForm existing={null} />
    </div>
  )
}

/** One price list: the same form, its products and prices, on/off and delete. */
export function PriceListPage() {
  const { t } = useTranslation()
  const { id } = detailRoute.useParams()
  const query = useQuery(priceListQuery(id))
  const back = { to: BACK_TO, label: t("priceLists.sectionPriceLists") }
  // A failed read again (after a save, say) keeps the page and its form
  if (query.isError && !query.data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("priceLists.title")} back={back} />
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
  const list = query.data
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={list.title}
        badge={<ListBadge list={list} />}
        back={back}
        action={<Actions list={list} />}
      />
      <PriceListForm key={list.id} existing={list} />
      <PriceLinesCard listId={list.id} />
    </div>
  )
}
